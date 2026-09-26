/* МОСЭВАК 24 — логика страницы «Политика конфиденциальности».
   Вынесено из privacy.html для кэширования и строгого CSP без 'unsafe-inline'.
   Кнопка печати — через addEventListener, inline-атрибут onclick в разметке нет. */

(function () {
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }
})();
