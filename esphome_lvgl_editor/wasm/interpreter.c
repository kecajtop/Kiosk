/*
 * Generyczny "interpreter" drzewa widgetów edytora LVGL na prawdziwe wywołania biblioteki
 * LVGL (skompilowanej do WebAssembly). Zamiast kompilować konkretny układ użytkownika do C
 * (co wymagałoby przebudowy WASM przy każdej edycji — za wolne na podgląd na żywo), ten
 * plik kompiluje się RAZ do jednego generycznego "silnika", który przy każdym wywołaniu
 * lv_preview_render() dostaje aktualny stan edytora jako JSON, czyści poprzednie drzewo
 * widgetów i buduje je od nowa, wywołując prawdziwe funkcje LVGL (lv_obj_create,
 * lv_label_create, lv_obj_set_style_bg_color, ...), po czym wymusza jedno, natychmiastowe
 * odświeżenie bufora ramki. JS odczytuje potem ten bufor i rysuje go na <canvas>.
 *
 * Zakres (v1): obj, label, button, bar, slider, switch, checkbox, arc, led, dropdown, line,
 * roller, textarea, spinbox, buttonmatrix — z najczęściej używanymi właściwościami
 * (pozycja/rozmiar/wyrównanie, kolory, obramowanie, zaokrąglenie, padding, czcionka,
 * tekst/wartość). To NIE jest pełne pokrycie schematu `lvgl:` ESPHome — rozszerzanie o
 * kolejne widgety/właściwości jest kolejnym, odrębnym krokiem.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "lvgl.h"
#include "vendor/cJSON.h"

static lv_display_t *g_disp = NULL;
static uint8_t *g_draw_buf = NULL;
static int32_t g_width = 0;
static int32_t g_height = 0;

/* ---------------------------------------------------------------- pomocnicze: kolory/typy */

static lv_color_t hex_to_color(const char *hex) {
    if (!hex || hex[0] != '#') return lv_color_black();
    unsigned int r = 0, g = 0, b = 0;
    size_t len = strlen(hex);
    if (len >= 7) {
        sscanf(hex + 1, "%02x%02x%02x", &r, &g, &b);
    }
    return lv_color_make((uint8_t)r, (uint8_t)g, (uint8_t)b);
}

static const char *jstr(cJSON *node, const char *key, const char *fallback) {
    cJSON *v = cJSON_GetObjectItemCaseSensitive(node, key);
    if (cJSON_IsString(v) && v->valuestring) return v->valuestring;
    return fallback;
}

static int has_key(cJSON *node, const char *key) {
    cJSON *v = cJSON_GetObjectItemCaseSensitive(node, key);
    return v != NULL && !cJSON_IsNull(v);
}

static double jnum(cJSON *node, const char *key, double fallback) {
    cJSON *v = cJSON_GetObjectItemCaseSensitive(node, key);
    if (cJSON_IsNumber(v)) return v->valuedouble;
    return fallback;
}

static int jbool(cJSON *node, const char *key, int fallback) {
    cJSON *v = cJSON_GetObjectItemCaseSensitive(node, key);
    if (cJSON_IsBool(v)) return cJSON_IsTrue(v) ? 1 : 0;
    return fallback;
}

static lv_align_t parse_align(const char *s) {
    if (!s) return LV_ALIGN_DEFAULT;
    if (!strcmp(s, "CENTER")) return LV_ALIGN_CENTER;
    if (!strcmp(s, "TOP_LEFT")) return LV_ALIGN_TOP_LEFT;
    if (!strcmp(s, "TOP_MID")) return LV_ALIGN_TOP_MID;
    if (!strcmp(s, "TOP_RIGHT")) return LV_ALIGN_TOP_RIGHT;
    if (!strcmp(s, "BOTTOM_LEFT")) return LV_ALIGN_BOTTOM_LEFT;
    if (!strcmp(s, "BOTTOM_MID")) return LV_ALIGN_BOTTOM_MID;
    if (!strcmp(s, "BOTTOM_RIGHT")) return LV_ALIGN_BOTTOM_RIGHT;
    if (!strcmp(s, "LEFT_MID")) return LV_ALIGN_LEFT_MID;
    if (!strcmp(s, "RIGHT_MID")) return LV_ALIGN_RIGHT_MID;
    return LV_ALIGN_DEFAULT;
}

static const lv_font_t *font_for_size(int size) {
    switch (size) {
#if LV_FONT_MONTSERRAT_12
        case 12: return &lv_font_montserrat_12;
#endif
#if LV_FONT_MONTSERRAT_14
        case 14: return &lv_font_montserrat_14;
#endif
#if LV_FONT_MONTSERRAT_16
        case 16: return &lv_font_montserrat_16;
#endif
#if LV_FONT_MONTSERRAT_20
        case 20: return &lv_font_montserrat_20;
#endif
#if LV_FONT_MONTSERRAT_24
        case 24: return &lv_font_montserrat_24;
#endif
#if LV_FONT_MONTSERRAT_28
        case 28: return &lv_font_montserrat_28;
#endif
#if LV_FONT_MONTSERRAT_32
        case 32: return &lv_font_montserrat_32;
#endif
#if LV_FONT_MONTSERRAT_36
        case 36: return &lv_font_montserrat_36;
#endif
#if LV_FONT_MONTSERRAT_40
        case 40: return &lv_font_montserrat_40;
#endif
#if LV_FONT_MONTSERRAT_48
        case 48: return &lv_font_montserrat_48;
#endif
        default: return LV_FONT_DEFAULT;
    }
}

/* ------------------------------------------------------------ wspólne właściwości stylu */

static void apply_common_style(lv_obj_t *obj, cJSON *node) {
    if (has_key(node, "bg_color")) {
        lv_obj_set_style_bg_color(obj, hex_to_color(jstr(node, "bg_color", "#ffffff")), 0);
        lv_obj_set_style_bg_opa(obj, (int)jnum(node, "bg_opa", 255), 0);
    }
    if (has_key(node, "text_color")) {
        lv_obj_set_style_text_color(obj, hex_to_color(jstr(node, "text_color", "#000000")), 0);
    }
    if (has_key(node, "border_color") || has_key(node, "border_width")) {
        lv_obj_set_style_border_color(obj, hex_to_color(jstr(node, "border_color", "#555555")), 0);
        lv_obj_set_style_border_width(obj, (int)jnum(node, "border_width", 1), 0);
    }
    if (has_key(node, "radius")) {
        lv_obj_set_style_radius(obj, (int)jnum(node, "radius", 0), 0);
    }
    if (has_key(node, "pad_all")) {
        int p = (int)jnum(node, "pad_all", 0);
        lv_obj_set_style_pad_top(obj, p, 0);
        lv_obj_set_style_pad_bottom(obj, p, 0);
        lv_obj_set_style_pad_left(obj, p, 0);
        lv_obj_set_style_pad_right(obj, p, 0);
    }
    if (has_key(node, "pad_top")) lv_obj_set_style_pad_top(obj, (int)jnum(node, "pad_top", 0), 0);
    if (has_key(node, "pad_bottom")) lv_obj_set_style_pad_bottom(obj, (int)jnum(node, "pad_bottom", 0), 0);
    if (has_key(node, "pad_left")) lv_obj_set_style_pad_left(obj, (int)jnum(node, "pad_left", 0), 0);
    if (has_key(node, "pad_right")) lv_obj_set_style_pad_right(obj, (int)jnum(node, "pad_right", 0), 0);
    if (has_key(node, "text_font")) {
        lv_obj_set_style_text_font(obj, font_for_size((int)jnum(node, "text_font", 14)), 0);
    }

    int has_w = has_key(node, "width");
    int has_h = has_key(node, "height");
    if (has_w || has_h) {
        lv_obj_set_size(obj,
                         has_w ? (int)jnum(node, "width", LV_SIZE_CONTENT) : LV_SIZE_CONTENT,
                         has_h ? (int)jnum(node, "height", LV_SIZE_CONTENT) : LV_SIZE_CONTENT);
    }

    const char *align = jstr(node, "align", NULL);
    lv_align_t a = parse_align(align);
    if (a != LV_ALIGN_DEFAULT) {
        lv_obj_align(obj, a, (int)jnum(node, "x", 0), (int)jnum(node, "y", 0));
    } else if (has_key(node, "x") || has_key(node, "y")) {
        lv_obj_set_pos(obj, (int)jnum(node, "x", 0), (int)jnum(node, "y", 0));
    }
}

static void build_node(lv_obj_t *parent, cJSON *node);

static void build_children(lv_obj_t *obj, cJSON *node) {
    cJSON *children = cJSON_GetObjectItemCaseSensitive(node, "children");
    if (cJSON_IsArray(children)) {
        cJSON *child = NULL;
        cJSON_ArrayForEach(child, children) {
            build_node(obj, child);
        }
    }
}

static void build_node(lv_obj_t *parent, cJSON *node) {
    const char *type = jstr(node, "type", "obj");
    lv_obj_t *obj = NULL;

    if (!strcmp(type, "label")) {
        obj = lv_label_create(parent);
        lv_label_set_text(obj, jstr(node, "text", ""));
    } else if (!strcmp(type, "button")) {
        obj = lv_button_create(parent);
        const char *text = jstr(node, "text", NULL);
        if (text) {
            lv_obj_t *lbl = lv_label_create(obj);
            lv_label_set_text(lbl, text);
            lv_obj_center(lbl);
        }
    } else if (!strcmp(type, "bar")) {
        obj = lv_bar_create(parent);
        lv_bar_set_range(obj, (int)jnum(node, "min", 0), (int)jnum(node, "max", 100));
        lv_bar_set_value(obj, (int)jnum(node, "value", 0), LV_ANIM_OFF);
    } else if (!strcmp(type, "slider")) {
        obj = lv_slider_create(parent);
        lv_slider_set_range(obj, (int)jnum(node, "min", 0), (int)jnum(node, "max", 100));
        lv_slider_set_value(obj, (int)jnum(node, "value", 0), LV_ANIM_OFF);
    } else if (!strcmp(type, "switch")) {
        obj = lv_switch_create(parent);
        if (jbool(node, "checked", 0)) lv_obj_add_state(obj, LV_STATE_CHECKED);
    } else if (!strcmp(type, "checkbox")) {
        obj = lv_checkbox_create(parent);
        lv_checkbox_set_text(obj, jstr(node, "text", ""));
        if (jbool(node, "checked", 0)) lv_obj_add_state(obj, LV_STATE_CHECKED);
    } else if (!strcmp(type, "arc")) {
        obj = lv_arc_create(parent);
        lv_arc_set_range(obj, (int)jnum(node, "min", 0), (int)jnum(node, "max", 100));
        lv_arc_set_value(obj, (int)jnum(node, "value", 0));
    } else if (!strcmp(type, "led")) {
        obj = lv_led_create(parent);
        lv_led_set_color(obj, hex_to_color(jstr(node, "bg_color", "#ff0000")));
        lv_led_set_brightness(obj, jbool(node, "checked", 1) ? 255 : 80);
    } else if (!strcmp(type, "dropdown")) {
        obj = lv_dropdown_create(parent);
        lv_dropdown_set_options(obj, jstr(node, "options", "Opcja 1\nOpcja 2"));
    } else if (!strcmp(type, "roller")) {
        obj = lv_roller_create(parent);
        lv_roller_set_options(obj, jstr(node, "options", "Opcja 1\nOpcja 2"), LV_ROLLER_MODE_NORMAL);
    } else if (!strcmp(type, "textarea")) {
        obj = lv_textarea_create(parent);
        lv_textarea_set_text(obj, jstr(node, "text", ""));
    } else if (!strcmp(type, "spinbox")) {
        obj = lv_spinbox_create(parent);
    } else if (!strcmp(type, "buttonmatrix")) {
        obj = lv_buttonmatrix_create(parent);
    } else if (!strcmp(type, "line")) {
        obj = lv_line_create(parent);
    } else {
        obj = lv_obj_create(parent);
    }

    apply_common_style(obj, node);
    if (!strcmp(type, "obj")) {
        build_children(obj, node);
    }
}

/* -------------------------------------------------------------------------- API dla JS */

EMSCRIPTEN_KEEPALIVE
void lv_preview_init(int32_t width, int32_t height) {
    lv_init();

    g_width = width;
    g_height = height;
    size_t buf_size = (size_t)width * (size_t)height * 4; /* LV_COLOR_DEPTH 32 -> 4 B/px */
    g_draw_buf = (uint8_t *)malloc(buf_size);

    g_disp = lv_display_create(width, height);
    lv_display_set_buffers(g_disp, g_draw_buf, NULL, (uint32_t)buf_size, LV_DISPLAY_RENDER_MODE_FULL);
    /* Brak prawdziwego ekranu - nic nie trzeba "wysyłać" przy flush, bufor czytamy wprost z WASM. */
    lv_display_set_flush_cb(g_disp, NULL);
    lv_display_set_default(g_disp);
}

EMSCRIPTEN_KEEPALIVE
uint8_t *lv_preview_get_buffer(void) {
    return g_draw_buf;
}

EMSCRIPTEN_KEEPALIVE
int32_t lv_preview_get_buffer_size(void) {
    return (int32_t)((size_t)g_width * (size_t)g_height * 4);
}

EMSCRIPTEN_KEEPALIVE
void lv_preview_render(const char *json) {
    if (!g_disp) return;

    lv_obj_t *scr = lv_screen_active();
    lv_obj_clean(scr);

    cJSON *root = cJSON_Parse(json);
    if (!root) return;

    const char *screen_bg = jstr(root, "screen_bg_color", "#ffffff");
    lv_obj_set_style_bg_color(scr, hex_to_color(screen_bg), 0);
    lv_obj_set_style_bg_opa(scr, 255, 0);
    lv_obj_set_style_pad_all(scr, 0, 0);
    lv_obj_set_style_border_width(scr, 0, 0);
    lv_obj_set_style_radius(scr, 0, 0);

    cJSON *widgets = cJSON_GetObjectItemCaseSensitive(root, "widgets");
    if (cJSON_IsArray(widgets)) {
        cJSON *w = NULL;
        cJSON_ArrayForEach(w, widgets) {
            build_node(scr, w);
        }
    }

    cJSON_Delete(root);

    lv_tick_inc(16);
    lv_timer_handler();
    lv_refr_now(g_disp);
}
