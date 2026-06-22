const APP_ORIGIN = "http://localhost:3000"

// Injected into the page's isolated world via chrome.scripting — this runs
// outside the page's own CSP (script-src), which is what blocks plain
// javascript: bookmarklets on sites like Mercado Libre.
function extractProduct() {
  function text(el) {
    return el ? el.textContent.trim() : ""
  }

  function pickPrice() {
    var blocks = document.querySelectorAll('script[type="application/ld+json"]')
    for (var i = 0; i < blocks.length; i++) {
      try {
        var data = JSON.parse(blocks[i].textContent)
        var items = Array.isArray(data) ? data : [data]
        for (var j = 0; j < items.length; j++) {
          var offers = items[j] && items[j].offers
          var offer = Array.isArray(offers) ? offers[0] : offers
          var p = offer && (offer.price || offer.lowPrice)
          if (p) return String(p)
        }
      } catch (e) {
        // malformed JSON-LD block — ignore and keep looking
      }
    }
    var fraction = document.querySelector(".andes-money-amount__fraction")
    if (fraction) return text(fraction)
    var meta =
      document.querySelector('meta[itemprop="price"]') ||
      document.querySelector('meta[property="product:price:amount"]')
    if (meta) return meta.content
    var nodes = document.querySelectorAll('[class*="price" i]')
    for (var k = 0; k < nodes.length; k++) {
      var t = text(nodes[k])
      if (/\d/.test(t)) return t
    }
    return ""
  }

  function pickImage() {
    var og = document.querySelector('meta[property="og:image"]')
    if (og && og.content) return og.content
    var img =
      document.querySelector("figure img") ||
      document.querySelector('[class*="gallery" i] img') ||
      document.querySelector("img")
    return img ? img.src : ""
  }

  function pickName() {
    var og = document.querySelector('meta[property="og:title"]')
    if (og && og.content) return og.content
    var h1 = document.querySelector("h1")
    if (h1) return text(h1)
    return document.title
  }

  return {
    url: location.href,
    name: pickName(),
    price: pickPrice(),
    image: pickImage(),
  }
}

function showAlert(message) {
  alert(message)
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return

  let result
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractProduct,
    })
    result = injection?.result
  } catch (err) {
    console.error("Vaulty: no se pudo leer la página", err)
    return
  }

  if (!result || !result.price) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: showAlert,
      args: ["No pude encontrar el precio en esta página. Probá agregarlo a mano en la app."],
    })
    return
  }

  const qs = new URLSearchParams({
    url: result.url,
    name: result.name,
    price: result.price,
    image: result.image,
  })
  chrome.tabs.create({ url: `${APP_ORIGIN}/api/tracker/quick-add?${qs.toString()}` })
})
