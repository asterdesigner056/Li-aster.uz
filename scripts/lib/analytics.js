/**
 * Счётчики аналитики. Включаются, если в config.json → analytics указан ID.
 * Их встроенные скрипты автоматически попадают в Content Security Policy по хешу (см. csp.js).
 */
function analyticsSnippets(a = {}) {
  let head = '';
  // Google Tag Manager — ставится сразу после <head> (так требует Google)
  const gtm = a.gtm ? `<script async src="https://www.googletagmanager.com/gtm.js?id=${a.gtm}"></script>\n<script>\nwindow.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\n</script>\n` : '';
  if (a.ga4) head += `<script async src="https://www.googletagmanager.com/gtag/js?id=${a.ga4}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${a.ga4}');</script>\n`;
  if (a.yandexMetrika) head += `<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${a.yandexMetrika},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});</script>\n`;
  if (a.metaPixel) head += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${a.metaPixel}');fbq('track','PageView');</script>\n`;
  const body = a.yandexMetrika ? `<noscript><div><img src="https://mc.yandex.ru/watch/${a.yandexMetrika}" style="position:absolute;left:-9999px" alt=""></div></noscript>` : '';
  return { gtm, head, body };
}

module.exports = { analyticsSnippets };
