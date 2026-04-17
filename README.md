# Plataforma de Censura Judicial (Versión Web / Serverless)

Una aplicación web diseñada específicamente para juzgados e instituciones legales para censurar ("testar") documentos en formato Word (`.docx`) de manera automatizada y con absoluta preocupación por la confidencialidad.

![Plataforma de Censura](https://img.shields.io/badge/Estado-Completado-success) ![Privacidad](https://img.shields.io/badge/Privacidad-100%25_Local-blue) ![Tecnologías](https://img.shields.io/badge/Tecnolog%C3%ADa-HTML5_|_JSZip-yellow)

## ✨ Características Principales
Esta herramienta fue diseñada con el objetivo de ser extremadamente fácil de usar para abogados y secretarios, no para programadores.

- **Cero Instalación**: Funciona ejecutando un archivo `index.html`. 
- **100% Confidencial (Serverless)**: El procesamiento se realiza de manera local en la memoria RAM del navegador. Los documentos `.docx` **jamás salen de la computadora local ni se envían a servidores de internet**, protegiendo el secreto profesional de la institución.
- **Detección Automática**:
  - Nombres propios y apellidos.
  - CURPs de ciudadanos mexicanos.
  - RFCs (Registro Federal de Contribuyentes).
  - Correos Electrónicos.
  - Números de teléfono.
- **Censura Efectiva**: Interviene directamente sobre el código XML interno que compone al documento `.docx` de Microsoft Word, cambiando los textos sensibles por bloques sólidos (`████████`).

## 🚀 ¿Cómo usarlo?

¡Es de lo más sencillo!
1. Descarga los archivos de este repositorio (o utilízalos mediante una página web de GitHub Pages).
2. Haz doble clic sobre el archivo principal: **`index.html`**
3. Se abrirá una interfaz gráfica en tu navegador (Chrome, Edge o Safari).
4. Arrastra tu documento oficial (`.docx`) hacia el recuadro que aparecerá.
5. Verás una barra de carga, y cuando finalice, el documento censurado listo se descargará a tu computadora de inmediato.

## 🛠 Recomendaciones Legales
Aunque la herramienta acorta y automatiza un 90% del trabajo de censura en resoluciones y sentencias públicas, funciona mediante fórmulas algorítmicas de coincidencia de texto e heurística. **Se recomienda una rápida revisión ocular por mandato humano** al texto censurado por cualquier error de exclusión de coincidencia previo a su publicación o integración al marco oficial.

## 💻 Detalles Técnicos para Desarrolladores
Este es un desarrollo puramente Front-End, no requiere Python, Node, NPM ni servidores backend para funcionar. Reemplaza el texto iterando y descomprimiendo el `.docx` en el propio hilo del cliente con la biblioteca **[JSZip](https://stuk.github.io/jszip/)**.
