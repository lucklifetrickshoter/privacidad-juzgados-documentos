/* ==========================================================================
   CensuraDoc — Motor de Censura v3.0
   ARQUITECTURA DE DOS PASADAS:
   - Pasada 1: Por cada <w:t> individual → CURP, RFC, emails, teléfonos, fechas, domicilios
   - Pasada 2: Por cada <w:p> párrafo completo → NOMBRES (resuelve el problema de que
     Word fragmenta "Carlos Garcia" en varios <w:t> distintos)
   ========================================================================== */

(function () {
    'use strict';

    // ── DOM ─────────────────────────────────────────────────────────────────
    const dropArea        = document.getElementById('drop-area');
    const fileInput       = document.getElementById('file-input');
    const errorBanner     = document.getElementById('error-banner');
    const errorText       = document.getElementById('error-text');
    const stepUpload      = document.getElementById('step-upload');
    const stepProcessing  = document.getElementById('step-processing');
    const stepResults     = document.getElementById('step-results');
    const fileNameDisplay = document.getElementById('file-name-display');
    const progressLabel   = document.getElementById('progress-label');
    const progressPct     = document.getElementById('progress-pct');
    const progressBar     = document.getElementById('progress-bar');
    const scanItems       = document.querySelectorAll('.scan-item');
    const statsSummary    = document.getElementById('stats-summary');
    const downloadBtn     = document.getElementById('download-btn');
    const resetBtn        = document.getElementById('reset-btn');
    const themeToggle     = document.getElementById('theme-toggle');
    const modeTabs        = document.querySelectorAll('.mode-tab');

    // ── ESTADO ──────────────────────────────────────────────────────────────
    let originalFileBuffer = null;
    let originalFileName   = '';
    let currentMode        = 'block';
    let scanCounters       = {};

    // Archivos XML dentro del .docx que contienen texto editable
    const DOCX_XML_PATTERN = /^word\/(document|header\d*|footer\d*|endnotes|footnotes)\.xml$/;

    // ── TEMA ────────────────────────────────────────────────────────────────
    applyTheme(localStorage.getItem('censura-theme') || 'light');

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        applyTheme(isDark ? 'light' : 'dark');
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('censura-theme', theme);
        themeToggle.querySelector('i').className =
            theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    // ── MODO DE CENSURA ──────────────────────────────────────────────────────
    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
        });
    });

    function getCensor() {
        if (currentMode === 'bold')     return '[DATOS PERSONALES]';
        if (currentMode === 'asterisk') return '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
        return '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'; // ████████
    }

    // ── DRAG & DROP ──────────────────────────────────────────────────────────
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
        document.body.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter', 'dragover'].forEach(evt =>
        dropArea.addEventListener(evt, () => dropArea.classList.add('drag-active')));
    ['dragleave', 'drop'].forEach(evt =>
        dropArea.addEventListener(evt, () => dropArea.classList.remove('drag-active')));

    dropArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
    fileInput.addEventListener('change', function () { handleFiles(this.files); });

    // ── MANEJO DEL ARCHIVO ───────────────────────────────────────────────────
    function handleFiles(files) {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.name.toLowerCase().endsWith('.docx')) {
            showError('Solo se aceptan archivos Microsoft Word (.docx)');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            showError('El archivo supera el límite de 50 MB');
            return;
        }
        originalFileName = file.name;
        fileNameDisplay.textContent = originalFileName;
        hideError();
        showStep(stepProcessing);
        scanDocument(file);
    }

    // ── PROGRESO ─────────────────────────────────────────────────────────────
    function setProgress(pct, label) {
        progressBar.style.width = pct + '%';
        progressPct.textContent  = pct + '%';
        progressLabel.textContent = label;
    }

    let activeScanIdx = -1;
    function activateScanStep(idx) {
        if (activeScanIdx >= 0 && scanItems[activeScanIdx]) {
            scanItems[activeScanIdx].classList.remove('active');
            scanItems[activeScanIdx].classList.add('done');
        }
        activeScanIdx = idx;
        if (scanItems[idx]) scanItems[idx].classList.add('active');
    }
    function completeScanItems() {
        scanItems.forEach(i => { i.classList.remove('active'); i.classList.add('done'); });
    }
    function resetScanItems() {
        activeScanIdx = -1;
        scanItems.forEach(i => i.classList.remove('active', 'done'));
    }

    // ── FASE 1: ESCANEO (solo para estadísticas, el original no se toca) ────
    async function scanDocument(file) {
        resetScanItems();
        scanCounters = { names: 0, curp: 0, rfc: 0, dates: 0, phones: 0, emails: 0, addresses: 0, nss: 0 };

        try {
            if (typeof JSZip === 'undefined') throw new Error('JSZip no disponible. Verifica conexión a internet.');

            originalFileBuffer = await file.arrayBuffer();

            setProgress(15, 'Leyendo estructura del documento...');
            await sleep(200);

            const zip = await new JSZip().loadAsync(originalFileBuffer.slice(0));

            setProgress(30, 'Buscando nombres...');
            activateScanStep(0);
            await sleep(150);

            setProgress(50, 'Analizando CURPs y RFCs...');
            activateScanStep(1);
            await sleep(150);

            setProgress(65, 'Detectando fechas...');
            activateScanStep(2);
            await sleep(150);

            setProgress(78, 'Identificando domicilios...');
            activateScanStep(3);
            await sleep(150);

            setProgress(88, 'Rastreando teléfonos y correos...');
            activateScanStep(4);
            await sleep(150);

            // Escanear XML para contar (sin modificar el zip original)
            for (const filename in zip.files) {
                if (DOCX_XML_PATTERN.test(filename)) {
                    const xml = await zip.file(filename).async('string');
                    censorXml(xml, scanCounters); // Solo cuenta
                }
            }

            completeScanItems();
            setProgress(100, '¡Análisis completado!');
            await sleep(400);

            updateStatsUI();
            showStep(stepResults);

        } catch (err) {
            console.error('[CensuraDoc]', err);
            showStep(stepUpload);
            showError('Error al leer el documento: ' + err.message);
        }
    }

    // ── FASE 2: DESCARGA (aplica censura con el modo elegido por el usuario) ─
    downloadBtn.addEventListener('click', async () => {
        if (!originalFileBuffer) return;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando archivo…';

        try {
            const dlCounters = { names: 0, curp: 0, rfc: 0, dates: 0, phones: 0, emails: 0, addresses: 0, nss: 0 };
            const zip = await new JSZip().loadAsync(originalFileBuffer.slice(0));

            for (const filename in zip.files) {
                if (DOCX_XML_PATTERN.test(filename)) {
                    const original = await zip.file(filename).async('string');
                    const censored = censorXml(original, dlCounters);
                    zip.file(filename, censored);
                }
            }

            const uint8 = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 5 } });
            const blob  = new Blob([uint8], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url   = URL.createObjectURL(blob);
            const link  = document.createElement('a');
            link.href     = url;
            link.download = 'CENSURADO_' + originalFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 15000);

        } catch (err) {
            console.error('[CensuraDoc] Error al generar:', err);
            alert('Error al generar el documento: ' + err.message);
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Descargar Documento Censurado';
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    //  MOTOR DE CENSURA
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Punto de entrada principal. Aplica censura en dos pasadas:
     * Pasada 1 → patrones exactos nodo a nodo (<w:t>)
     * Pasada 2 → nombres a nivel de párrafo (<w:p>), resuelve el problema de
     *            texto fragmentado en múltiples runs de Word
     */
    function censorXml(xml, counters) {
        // PASADA 1: Patrones exactos node por node
        let result = xml.replace(
            /(<w:t(?:[^>]*)>)([\s\S]*?)(<\/w:t>)/g,
            (_, open, text, close) => {
                if (!text || !text.trim()) return open + text + close;
                return open + censorExactPatterns(text, counters) + close;
            }
        );

        // PASADA 2: Nombres a nivel de párrafo completo
        result = result.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, pXml =>
            censorNamesInParagraph(pXml, counters)
        );

        return result;
    }

    // ── PASADA 1: Patrones exactos ───────────────────────────────────────────
    function censorExactPatterns(text, counters) {
        let t = text;

        // 1. CURP (formato oficial 18 caracteres)
        t = t.replace(
            /\b[A-Z]{4}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9][0-9A]\b/gi,
            () => { counters.curp++; return getCensor(); }
        );

        // 2. RFC (12-13 chars, formato SAT)
        t = t.replace(
            /\b[A-ZÑ&]{3,4}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[A-Z\d]{3}\b/gi,
            () => { counters.rfc++; return getCensor(); }
        );

        // 3. NSS/IMSS con guiones: 00-00-00-0000-0
        t = t.replace(
            /\b\d{2}-\d{2}-\d{2}-\d{4}-\d\b/g,
            () => { counters.nss++; return getCensor(); }
        );
        // NSS con keyword explícita
        t = t.replace(
            /(?:NSS|N\.S\.S\.|No\.?\s*(?:de\s+)?Seguro\s+Social)\s*:?\s*#?\s*(\d[\d\s\-]{9,14}\d)/gi,
            (full, num) => { counters.nss++; return full.replace(num, getCensor()); }
        );

        // 4. Correos electrónicos
        t = t.replace(
            /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/gi,
            () => { counters.emails++; return getCensor(); }
        );

        // 5. Teléfonos mexicanos (10 dígitos, con o sin +52, con o sin separadores)
        t = t.replace(
            /(?<!\d)(?:\+?52[\s.\-]?)?(?:\(?\d{2,3}\)?[\s.\-]?)(?:\d{3,4}[\s.\-]?\d{4})(?!\d)/g,
            (m) => {
                const digits = m.replace(/\D/g, '');
                if (digits.length >= 10 && digits.length <= 13) {
                    counters.phones++;
                    return getCensor();
                }
                return m;
            }
        );

        // 6. Fechas DD/MM/AAAA o DD-MM-AAAA
        t = t.replace(
            /\b(?:0?[1-9]|[12]\d|3[01])[\/\-](?:0?[1-9]|1[0-2])[\/\-](?:19|20)\d{2}\b/g,
            () => { counters.dates++; return getCensor(); }
        );
        // Fechas "12 de enero de 1990"
        t = t.replace(
            /\b(?:0?[1-9]|[12]\d|3[01])\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(?:19|20)\d{2}\b/gi,
            () => { counters.dates++; return getCensor(); }
        );
        // "nacido el", "fecha de nacimiento:" + fecha
        t = t.replace(
            /(?:nacid[oa]?\s+(?:el|en)|fecha\s+de\s+nacimiento\s*:?\s*)(?:el\s+)?(?:0?[1-9]|[12]\d|3[01])[\s\/\-]+(?:0?[1-9]|1[0-2]|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\/\-]+(?:19|20)\d{2}/gi,
            () => { counters.dates++; return getCensor(); }
        );

        // 7. Código Postal explícito
        t = t.replace(
            /\bC\.?P\.?\s*(?:No\.?\s*)?\d{5}\b/gi,
            () => { counters.addresses++; return getCensor(); }
        );

        // 8. Domicilios: keyword vial + nombre + número
        t = t.replace(
            /\b(?:Calle|Cll?\.?|Avenida|Av\.?|Boulevard|Blvd\.?|Calzada|Calz\.?|Privada|Priv\.?|Carretera|Carr\.?|Cerrada|Camino|Andador|Paseo|Circuito|Vialidad|Prolongación|Prol\.?|Retorno|Ret\.?)\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s\.]{1,50}(?:No\.?|Núm\.?|#)?\s*\d+/gi,
            () => { counters.addresses++; return getCensor(); }
        );
        // Colonia / Fraccionamiento
        t = t.replace(
            /\b(?:Colonia|Col\.?|Fraccionamiento|Fracc\.?|Barrio|Bo\.?|Unidad\s+Habitacional|U\.?H\.?)\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]{2,40}/g,
            () => { counters.addresses++; return getCensor(); }
        );

        return t;
    }

    // ── PASADA 2: Nombres a nivel de párrafo ─────────────────────────────────

    /**
     * Lista de palabras que NUNCA deben censurarse aunque estén capitalizadas.
     */
    const EXCLUDE = new Set([
        'el','la','los','las','un','una','unos','unas','de','del','en','por','para',
        'con','sin','sobre','bajo','ante','tras','según','entre','hacia','hasta',
        'desde','durante','mediante','y','o','u','e','ni','pero','sino',
        'que','como','cuando','donde','si','ya','más','al',
        // Institucionales
        'juzgado','tribunal','supremo','corte','poder','judicial',
        'juez','jueza','magistrado','magistrada',
        'secretario','secretaria','licenciado','licenciada',
        'doctor','doctora','ingeniero','ingeniera',
        'actor','actora','demandado','demandada',
        'quejoso','quejosa','tercero','tercera','testigo','perito','perita',
        'expediente','juicio','amparo','resolución','sentencia','acuerdo',
        'civil','penal','familiar','mercantil','laboral','administrativo',
        'federal','constitución','república','nación','estado',
        'méxico','mexicano','mexicana','chihuahua','ciudad','municipio',
        'artículo','fracción','inciso','párrafo','numeral','capítulo','sección',
        // Meses
        'enero','febrero','marzo','abril','mayo','junio',
        'julio','agosto','septiembre','octubre','noviembre','diciembre',
        // Días
        'lunes','martes','miércoles','jueves','viernes','sábado','domingo',
        // Términos comunes mal-capitalizados en documentos legales
        'banco','institución','empresa','sociedad','compañía','grupo','fondo',
    ]);

    /**
     * Palabras institucionales en MAYÚSCULAS que no se censuran.
     */
    const CAPS_EXCLUDE_RE = /^(?:JUZGADO|TRIBUNAL|PODER|JUDICIAL|SUPREMO|CÓDIGO|CONSTITUCIÓN|ESTADO|NACIÓN|REPÚBLICA|GOBIERNO|SECRETARÍA|IMSS|ISSSTE|SAT|CURP|RFC|NSS|NO|ART|FRACC|CAP|SEC|NUM|INC|PÁR|VS|ETC|S\.A|S\.DE|S\.C|A\.C|A\.B|BANCO|GRUPO|INSTITUTO|UNIVERSIDAD|COLEGIO)/;
    const CAPS_EXCLUDE = str => CAPS_EXCLUDE_RE.test(str);

    /**
     * Prefijos legales que anuncian un nombre de persona.
     * Cuando aparece uno de estos, la siguiente palabra (aunque sea sola) es un nombre.
     */
    const LEGAL_CTX = /\b(?:el\s+C\.|la\s+C\.|los?\s+CC\.|(?:el|la|los|las)\s+(?:ciudadano|ciudadana|ciudadanos|ciudadanas|señor|señora|sr\.?|sra\.?|promovente|quejoso|quejosa|actor|actora|demandado|demandada|suscrito|subscrito|testigo|menor|reo|imputado|imputada|agraviado|agraviada|víctima|ofendido|ofendida|notificado|notificada|perito|perita|compareciente|signante|firmante))\s+/gi;

    /**
     * Títulos profesionales/honoríficos seguidos de nombre.
     */
    const TITLE_PREFIX = /\b(?:Dr\.?a?|Lic\.?|Ing\.?|Mtro\.?|Mtra\.?|Sr\.?|Sra\.?|Prof\.?|Arq\.?)\s+/gi;

    /**
     * Busca patrones de nombre en el texto concatenado de un párrafo.
     * Devuelve array de {start, end} posiciones en el texto combinado.
     */
    function findNameRanges(combined) {
        const ranges = [];

        function addRange(start, end) {
            // Evitar duplicados/solapamientos con los ya encontrados
            if (ranges.some(r => start < r.end && end > r.start)) return;
            ranges.push({ start, end });
        }

        // ── A. Nombres en contexto legal (1+ palabras) ────────────────────
        // "el ciudadano García", "el C. González Pérez"
        const legalCtxRe = new RegExp(
            '(el\\s+C\\.|la\\s+C\\.|los?\\s+CC\\.|' +
            '(?:el|la|los|las)\\s+(?:ciudadano|ciudadana|ciudadanos|ciudadanas|señor|señora|sr\\.?|sra\\.?|' +
            'promovente|quejoso|quejosa|actor|actora|demandado|demandada|suscrito|subscrito|' +
            'testigo|menor|reo|imputado|imputada|agraviado|agraviada|víctima|ofendido|ofendida|' +
            'notificado|notificada|perito|perita|compareciente|signante|firmante))\\s+' +
            '([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,30}(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,30})*)',
            'gi'
        );
        let m;
        while ((m = legalCtxRe.exec(combined)) !== null) {
            const prefix = m[1];
            const name   = m[2];
            if (!EXCLUDE.has(name.split(/\s+/)[0].toLowerCase())) {
                const nameStart = m.index + prefix.length;
                addRange(nameStart, nameStart + name.length);
            }
        }

        // ── B. Nombres con título (Dr., Lic., Sr., ...) ───────────────────
        const titleRe = /\b(Dr\.?a?|Lic\.?|Ing\.?|Mtro\.?|Mtra\.?|Sr\.?|Sra\.?|Prof\.?|Arq\.?)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,30}(?:\s+[A-ZÁÉÍÓÚÑ]{1}[a-záéíóúñ]{1,30})*)/gi;
        while ((m = titleRe.exec(combined)) !== null) {
            const title  = m[1];
            const name   = m[2];
            const words  = name.split(/\s+/);
            if (!EXCLUDE.has(words[0].toLowerCase())) {
                const nameStart = m.index + title.length + 1; // +1 for the space
                addRange(nameStart, nameStart + name.length);
            }
        }

        // ── C. MAYÚSCULAS COMPLETAS: "JUAN GARCIA LOPEZ" ─────────────────
        // Muy común en escritos judiciales mexicanos
        const capsRe = /\b([A-ZÁÉÍÓÚÑ]{2,})(?:\s+[A-ZÁÉÍÓÚÑ]{2,})+\b/g;
        while ((m = capsRe.exec(combined)) !== null) {
            const match = m[0];
            const words = match.split(/\s+/);
            // Saltar si todas son institucionales
            if (words.every(w => EXCLUDE.has(w.toLowerCase()))) continue;
            if (CAPS_EXCLUDE(match.split(/\s+/)[0])) continue;
            // Institucionales compuestas conocidas
            if (/^(?:PODER\s+JUDICIAL|SUPREMA\s+CORTE|JUZGADO\s+|TRIBUNAL\s+|ESTADO\s+DE\s+|CIUDAD\s+DE)/i.test(match)) continue;
            addRange(m.index, m.index + match.length);
        }

        // ── D. NOMBRE: / APELLIDO: en formularios ────────────────────────
        const formRe = /(?:NOMBRE\s*:|Nombre\s*:|APELLIDOS?\s*:|Apellidos?\s*:)\s*([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]{2,50})/g;
        while ((m = formRe.exec(combined)) !== null) {
            const nameStart = combined.indexOf(m[1], m.index);
            if (nameStart !== -1) addRange(nameStart, nameStart + m[1].trim().length);
        }

        // ── E. Nombres compuestos de título-caso (2-5 palabras capital) ──
        // "Carlos Garcia", "María de los Ángeles Vega Torres"
        // NOTA: es la más genérica, se aplica al final para no duplicar
        const titleCaseRe = /(?<![a-záéíóúñ\d])([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,30})(\s+(?:(?:de|del?)\s+(?:la?|los?|las?)\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,30}){1,4}(?![a-záéíóúñ])/g;
        while ((m = titleCaseRe.exec(combined)) !== null) {
            const match = m[0];
            const words = match.split(/\s+/).filter(Boolean);

            if (words.length < 2) continue;                                    // mínimo 2 palabras

            const allEx = words.every(w => EXCLUDE.has(w.toLowerCase()));
            if (allEx) continue;                                               // todas excluidas → no es nombre

            // Palabras significativas (sin preposiciones)
            const sig = words.filter(w => !['de','del','la','los','las','al'].includes(w.toLowerCase()));
            if (!sig.length || EXCLUDE.has(sig[0].toLowerCase())) continue;   // 1ª sig. excluida
            if (sig.length > 1 && EXCLUDE.has(sig[1].toLowerCase())) continue;// 2ª sig. excluida

            // Saltar references legales tipo "Artículo 15", "Capítulo III"
            if (/^(?:Artículo|Art|Fracción|Fracc|Inciso|Párrafo|Numeral|Capítulo|Sección|Apartado)/i.test(match)) continue;

            addRange(m.index, m.index + match.length);
        }

        return ranges;
    }

    /**
     * Aplica censura de nombres a nivel de párrafo completo.
     * Resuelve el problema de texto fragmentado en múltiples <w:t> dentro de Word.
     */
    function censorNamesInParagraph(pXml, counters) {
        // Extraer todos los nodos <w:t> con sus posiciones en el XML del párrafo
        const tRegex = /(<w:t(?:[^>]*)>)([\s\S]*?)(<\/w:t>)/g;
        const nodes  = [];
        let m;
        while ((m = tRegex.exec(pXml)) !== null) {
            nodes.push({
                open:     m[1],
                text:     m[2],
                close:    m[3],
                xmlStart: m.index,
                xmlEnd:   m.index + m[0].length,
                combStart: 0,
                combEnd:   0
            });
        }
        if (nodes.length === 0) return pXml;

        // Construir texto combinado del párrafo con posiciones
        let combined = '';
        for (const n of nodes) {
            n.combStart = combined.length;
            combined += n.text;
            n.combEnd = combined.length;
        }

        // Encontrar rangos de nombres en el texto combinado
        const nameRanges = findNameRanges(combined);
        if (nameRanges.length === 0) return pXml;

        // Ordenar de derecha a izquierda para preservar posiciones XML al reemplazar
        nameRanges.sort((a, b) => b.start - a.start);

        let result = pXml;

        for (const range of nameRanges) {
            // Nodos afectados por este rango
            const affected = nodes.filter(n => n.combEnd > range.start && n.combStart < range.end);
            if (affected.length === 0) continue;

            counters.names++;
            const replacement = getCensor();

            if (affected.length === 1) {
                // ── Caso simple: el nombre está dentro de un solo nodo ────
                const node = affected[0];
                const ls   = range.start - node.combStart;
                const le   = range.end   - node.combStart;
                const newText = node.text.slice(0, ls) + replacement + node.text.slice(le);
                const newNode = node.open + newText + node.close;
                result = result.slice(0, node.xmlStart) + newNode + result.slice(node.xmlEnd);

            } else {
                // ── Caso cross-run: el nombre cruza múltiples <w:t> ──────
                // Ponemos el reemplazo en el primer nodo y vaciamos los demás
                const first = affected[0];
                const last  = affected[affected.length - 1];

                const ls    = range.start - first.combStart;
                const le    = range.end   - last.combStart;

                // Construir el nuevo bloque XML
                let newXml = first.open + first.text.slice(0, ls) + replacement + first.close;
                // Nodos intermedios: vaciar contenido pero preservar etiquetas (mantiene estilo del run)
                for (let i = 1; i < affected.length - 1; i++) {
                    newXml += affected[i].open + '' + affected[i].close;
                }
                // Último nodo: conservar el texto que queda después del nombre
                if (affected.length > 1) {
                    newXml += last.open + last.text.slice(le) + last.close;
                }

                result = result.slice(0, first.xmlStart) + newXml + result.slice(last.xmlEnd);
            }
        }

        return result;
    }

    // Wrapper que llama a censorNamesInParagraph (para uso desde censorXml)
    function censorNamesInParagraphWrapper(pXml, counters) {
        return censorNamesInParagraph(pXml, counters);
    }

    // ── ESTADÍSTICAS ─────────────────────────────────────────────────────────
    function updateStatsUI() {
        const c = scanCounters;
        const total = c.names + c.curp + c.rfc + c.dates + c.phones + c.emails + c.addresses + c.nss;
        document.getElementById('count-names').textContent  = c.names;
        document.getElementById('count-curp').textContent   = c.curp;
        document.getElementById('count-rfc').textContent    = c.rfc;
        document.getElementById('count-dates').textContent  = c.dates;
        document.getElementById('count-phones').textContent = c.phones;
        document.getElementById('count-emails').textContent = c.emails;
        document.getElementById('count-addr').textContent   = c.addresses + c.nss;
        document.getElementById('count-total').textContent  = total;

        statsSummary.textContent = total > 0
            ? `Se detectaron ${total} elemento(s) con datos personales. Elige modo de censura y descarga.`
            : 'No se identificaron datos personales automáticamente. Revisa manualmente el documento.';
    }

    // ── RESET ─────────────────────────────────────────────────────────────────
    resetBtn.addEventListener('click', reset);
    function reset() {
        originalFileBuffer = null;
        originalFileName   = '';
        scanCounters       = {};
        fileInput.value    = '';
        setProgress(0, 'Iniciando análisis...');
        resetScanItems();
        hideError();
        showStep(stepUpload);
    }

    // ── NAVEGACIÓN ────────────────────────────────────────────────────────────
    function showStep(el) {
        [stepUpload, stepProcessing, stepResults].forEach(s => s.classList.add('hidden'));
        el.classList.remove('hidden');
    }
    function showError(msg) { errorText.textContent = msg; errorBanner.classList.remove('hidden'); }
    function hideError()    { errorBanner.classList.add('hidden'); errorText.textContent = ''; }
    function sleep(ms)      { return new Promise(r => setTimeout(r, ms)); }

})();
