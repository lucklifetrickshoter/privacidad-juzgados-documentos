document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const fileNameDisplay = document.getElementById('file-name');
    const progressFill = document.querySelector('.progress-fill');
    const statusText = document.getElementById('status-text');
    const actionButtons = document.getElementById('action-buttons');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const errorMessage = document.getElementById('error-message');

    let processedBlobUrl = null;
    let originalFileName = "";
    
    // El clásico bloque negro que los abogados conocen
    const CENSURE_BLOCK = "████████";

    // Palabras estructurales que NUNCA deben censurarse aunque empiecen con mayúscula
    const EXCLUDE_WORDS = [
        "El", "La", "Los", "Las", "Un", "Una", "Y", "O", "En", "Para", "Por", "Según", "Sin", "Sobre", "Que",
        "Juzgado", "Juez", "Jueza", "Tribunal", "Supremo", "Corte", "Justicia", "Civil", "Penal", "Familiar", "Mercantil",
        "Secretario", "Secretaria", "Acuerdos", "Magistrado", "Poder", "Judicial", "Estado", "Chihuahua",
        "Actor", "Demandado", "Quejoso", "Tercero", "Testigo", "Perito", "Ciudad", "México", "Municipio", "Distrito",
        "Expediente", "Juicio", "Amparo", "Resolución", "Sentencia", "Foliado", "Licenciado", "Licenciada", "Lic", "Señor", "Señora"
    ].map(w => w.toLowerCase());

    // Eventos Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('active'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('active'));
    });

    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        
        if (!file.name.toLowerCase().endsWith('.docx')) {
            showError("Por favor, sube un archivo con formato .docx");
            return;
        }

        originalFileName = file.name;
        fileNameDisplay.textContent = originalFileName;
        
        // Transición de Interfaz
        dropArea.classList.add('hidden');
        uploadStatus.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        actionButtons.classList.add('hidden');
        
        progressFill.style.width = '30%';
        statusText.textContent = "Abriendo documento localmente...";

        processDocumentLocal(file);
    }

    async function processDocumentLocal(file) {
        try {
            if (typeof JSZip === 'undefined') {
                throw new Error("No tienes internet para descargar la herramienta JSZip. Verifica tu conexión la primera vez que abras esto.");
            }

            // Fake progress
            setTimeout(() => { progressFill.style.width = '60%'; statusText.textContent = "Buscando y censurando nombres..."; }, 500);

            const jsZip = new JSZip();
            const zip = await jsZip.loadAsync(file);
            
            // Un archivo docx es en realidad un ZIP. El texto está en word/document.xml
            // También revisaremos cabeceras y pies de página.
            const findFilesRegex = /^word\/(document|header|footer)\d*\.xml$/;
            
            for (let filename in zip.files) {
                if (findFilesRegex.test(filename)) {
                    let xmlContent = await zip.file(filename).async("string");
                    let redactedContent = applyCensorship(xmlContent);
                    zip.file(filename, redactedContent);
                }
            }

            progressFill.style.width = '90%';
            statusText.textContent = "Empaquetando documento protegido...";

            // Generar el nuevo docx
            const blob = await zip.generateAsync({
                type: "blob", 
                compression: "DEFLATE",
                compressionOptions: { level: 6 }
            });
            
            if (processedBlobUrl) URL.revokeObjectURL(processedBlobUrl);
            processedBlobUrl = URL.createObjectURL(blob);
            
            // Éxito UI
            progressFill.style.width = '100%';
            statusText.textContent = "¡Censura completada con éxito!";
            statusText.style.color = "var(--success)";
            actionButtons.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            progressFill.style.width = '10%';
            statusText.textContent = "Ocurrió un error inesperado al leer";
            statusText.style.color = "var(--danger)";
            showError(error.message);
            actionButtons.classList.remove('hidden');
            downloadBtn.classList.add('hidden');
        }
    }

    function applyCensorship(xml) {
        // En Word, el texto real se encuentra entre etiquetas <w:t> ... </w:t>
        // Utilizaremos Regex para extraer solo lo de adentro para evaluarlo y luego devolverlo.
        return xml.replace(/(<w:t(?:[^>]*?)>)(.*?)(<\/w:t>)/g, function(match, openTag, textContent, closeTag) {
            if (!textContent || textContent.trim() === '') return match;
            
            let n = textContent;
            
            // 1. Identificadores Mexicanos y Estándares
            n = n.replace(/[A-Z]{4}\d{6}[HM][A-Z\d]{7}/gi, CENSURE_BLOCK); // CURP
            n = n.replace(/[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}/gi, CENSURE_BLOCK); // RFC
            n = n.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, CENSURE_BLOCK); // Email
            n = n.replace(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,3}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, CENSURE_BLOCK); // Teléfonos
            
            // 2. Nombres (Heurística: 2 a más palabras que inician con mayúscula, que no estén en la lista negra).
            const namePattern = /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/g;
            n = n.replace(namePattern, function(foundName) {
                // Revisar la primera palabra
                const firstWord = foundName.split(/\s+/)[0].toLowerCase();
                const secondWord = foundName.split(/\s+/)[1].toLowerCase();
                
                // Si la primera palabra del supuesto nombre es "Juzgado", "Secretario", etc. lo ignoramos.
                if (EXCLUDE_WORDS.includes(firstWord) || EXCLUDE_WORDS.includes(secondWord)) {
                    return foundName;
                }
                return CENSURE_BLOCK;
            });
            
            return openTag + n + closeTag;
        });
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.classList.remove('hidden');
        actionButtons.classList.remove('hidden');
    }

    // Botones
    downloadBtn.addEventListener('click', () => {
        if (!processedBlobUrl) return;
        const a = document.createElement('a');
        a.href = processedBlobUrl;
        a.download = `CENSURADO_${originalFileName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    resetBtn.addEventListener('click', () => {
        uploadStatus.classList.add('hidden');
        dropArea.classList.remove('hidden');
        fileInput.value = "";
        statusText.style.color = "var(--primary-color)";
        progressFill.style.width = '0%';
        if (processedBlobUrl) {
            URL.revokeObjectURL(processedBlobUrl);
            processedBlobUrl = null;
        }
    });
});
