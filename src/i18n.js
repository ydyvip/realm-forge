"use strict";
/* ==========================================================================
   万象工坊 · i18n 核心（中英双语）
   约定：中文是源语言，同时充当翻译键。
   - 英文词典存放在 window.__EN（由 lang-*.js 片段填入）。
   - t(s, ...args) 在英文模式下查词典，找不到就回退原文（中文）。
   - {0} {1} 占位符在“查表之后”替换，因此两种语言可以采用不同词序。
   - 页面顶部提供 中 / EN 切换，默认中文，选择保存在 localStorage。
   - 切换语言后通过 location.reload() 用新语言重建全部动态内容
     （世界 / 角色 / 名册等都已持久化在 localStorage，可无损恢复）。
   ========================================================================== */
(function () {
  const KEY = "realmforge:v1:lang";
  const I18N = {
    lang: "zh",
    dict: {},
  };
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "zh") I18N.lang = saved;
  } catch (e) {
    /* 存储不可用时保持默认中文 */
  }
  window.__EN = window.__EN || {};
  I18N.dict = window.__EN;

  /* 翻译：英文模式查词典，其余情况返回原串；支持 {0}{1} 占位符 */
  function t(s, ...args) {
    if (s == null || s === "") return s;
    let out = s;
    if (I18N.lang === "en") {
      const hit = I18N.dict[String(s)];
      if (hit != null) out = hit;
    }
    if (args.length) {
      out = String(out).replace(/\{(\d+)\}/g, (m, i) =>
        args[+i] != null ? String(args[+i]) : m,
      );
    }
    return out;
  }

  function getLang() {
    return I18N.lang;
  }

  /* 静态文本：<html lang>、<title> 与所有 [data-i18n] 元素 */
  function applyStaticI18n(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key == null) return;
      try {
        if (el.hasAttribute("data-i18n-html")) el.innerHTML = t(key);
        else el.textContent = t(key);
      } catch (e) {
        /* 忽略个别元素的翻译失败 */
      }
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key == null) return;
      el.setAttribute("placeholder", t(key));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key == null) return;
      el.setAttribute("title", t(key));
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key == null) return;
      el.setAttribute("aria-label", t(key));
    });
    if (!root || root === document) {
      const docTitle = document.title;
      if (docTitle) document.title = t(docTitle);
    }
  }

  function syncLangSwitcher() {
    const box = document.getElementById("langSwitch");
    if (!box) return;
    box.querySelectorAll("[data-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === I18N.lang));
    });
  }

  function setLang(l) {
    const next = l === "en" ? "en" : "zh";
    if (next === I18N.lang) return;
    I18N.lang = next;
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {
      /* 忽略写入失败 */
    }
    applyStaticI18n();
    syncLangSwitcher();
  }

  function bindLangSwitcher() {
    const box = document.getElementById("langSwitch");
    if (!box) return;
    box.querySelectorAll("[data-lang]").forEach((b) => {
      b.addEventListener("click", () => {
        const next = b.dataset.lang;
        if (next === I18N.lang) return;
        setLang(next);
        document.documentElement.lang = next === "en" ? "en" : "zh-CN";
        location.reload();
      });
    });
  }

  window.t = t;
  window.getLang = getLang;
  window.setLang = setLang;
  window.applyStaticI18n = applyStaticI18n;
  window.__i18n = I18N;

  /* 尽早把已保存的语言套用到 <html lang> 上 */
  document.documentElement.lang = I18N.lang === "en" ? "en" : "zh-CN";
  document.documentElement.dataset.lang = I18N.lang;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      syncLangSwitcher();
      bindLangSwitcher();
      applyStaticI18n();
    });
  } else {
    syncLangSwitcher();
    bindLangSwitcher();
    applyStaticI18n();
  }
})();
