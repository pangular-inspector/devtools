(function () {
  const param = new URLSearchParams(location.search).get('theme');
  const theme =
    param === 'dark' ? 'dark' : param === 'default' || param === 'light' ? 'light' : null;
  if (theme) document.documentElement.dataset.theme = theme;
  const dark = theme ? theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
  const style = document.createElement('style');
  style.textContent = 'html{background:' + (dark ? '#0b0b0e' : '#ffffff') + '}';
  document.head.prepend(style);
})();
