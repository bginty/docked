const DOCKED_FULL_APP_SCRIPT_SRC = "https://cdn.jsdelivr.net/gh/bginty/docked@42bb4974b0cf6386301c1240b90ad923ec4dd308/script.js";
const DOCKED_PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const DOCKED_PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

(function bootDockedPatchedApp() {
  const appScript = document.createElement("script");
  appScript.src = DOCKED_FULL_APP_SCRIPT_SRC;
  appScript.onload = patchPdfReaderWorker;
  appScript.onerror = () => {
    const formStatus = document.querySelector("#formStatus");
    if (formStatus) formStatus.textContent = "The calculator tools are taking a moment to load. Please refresh and try again.";
  };
  document.head.appendChild(appScript);
})();

function patchPdfReaderWorker() {
  let dockedPdfJsPromise = null;

  window.loadPdfJs = async function loadPdfJs() {
    if (!dockedPdfJsPromise) {
      dockedPdfJsPromise = import(DOCKED_PDFJS_URL).then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = DOCKED_PDFJS_WORKER_URL;
        return pdfjs;
      });
    }
    return dockedPdfJsPromise;
  };
}
