(() => {
  const fullAppScriptSrc = "https://cdn.jsdelivr.net/gh/bginty/docked@42bb4974b0cf6386301c1240b90ad923ec4dd308/script.js";
  const pdfJsUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
  const pdfJsWorkerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

  const patchPdfReaderWorker = () => {
    let dockedPdfJsPromise = null;

    window.loadPdfJs = async function loadPdfJs() {
      if (!dockedPdfJsPromise) {
        dockedPdfJsPromise = import(pdfJsUrl).then((pdfjs) => {
          pdfjs.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;
          return pdfjs;
        });
      }
      return dockedPdfJsPromise;
    };
  };

  const appScript = document.createElement("script");
  appScript.src = fullAppScriptSrc;
  appScript.onload = patchPdfReaderWorker;
  appScript.onerror = () => {
    const formStatus = document.querySelector("#formStatus");
    if (formStatus) formStatus.textContent = "The calculator tools are taking a moment to load. Please refresh and try again.";
  };
  document.head.appendChild(appScript);
})();
