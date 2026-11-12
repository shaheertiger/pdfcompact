---
title: "PDF a Excel Gratis — Estados de Cuenta a .xlsx, Sin Subir"
description: "Convierte las tablas de un PDF en un archivo de Excel .xlsx en tu navegador. Los montos quedan como números reales y ves una vista previa. Sin subir nada."
h1: "PDF a Excel — Convierte tablas de un PDF en una hoja de cálculo"
lead: "Suelta un PDF con tablas, revisa la vista previa y descarga un .xlsx listo para ordenar y sumar."
answer: "Para pasar un PDF a Excel, suelta el archivo arriba y pulsa Convertir. La herramienta lee la posición del texto en cada página, detecta filas y columnas y crea un .xlsx donde montos como 3,250.00 o (12.00) son números reales que puedes sumar. Un estado de cuenta de 2 páginas tarda alrededor de un segundo. Funciona con PDF que tienen texto real; los escaneos necesitan OCR primero."
keywords: ["pdf a excel", "convertir pdf a excel", "pdf a excel gratis", "estado de cuenta pdf a excel", "pasar pdf a excel"]
updated: 2026-11-12
related: [excel-to-pdf, compress-pdf, merge-pdf, split-pdf]
faq:
  - q: "¿Es seguro convertir aquí mi estado de cuenta?"
    a: "Sí. Tu propio navegador lee el PDF y arma la hoja de cálculo en tu dispositivo. No se sube nada, así que los números de cuenta y los saldos nunca llegan a un servidor."
  - q: "¿Los montos quedan como números en Excel?"
    a: "Sí, cuando tienen forma de monto. Valores como 1,234.56, $3,250.00, (12.00), -5, 12.5 % o 1.234,56 se guardan como celdas numéricas con su formato, así que SUMA y ordenar funcionan de inmediato."
  - q: "¿Por qué dice que no encontró tablas?"
    a: "El PDF tiene texto, pero nada alineado en columnas, como una carta o un informe. Marca “Exportar también el texto fuera de las tablas” para obtener cada línea de texto en la columna A."
  - q: "¿Puedo convertir un PDF escaneado a Excel?"
    a: "No directamente. Un escaneo es una imagen sin texto que leer. Pásalo primero por [OCR PDF](/ocr-pdf) para añadirle una capa de texto y luego convierte el resultado aquí."
  - q: "¿Se conservan las celdas combinadas, los colores y los bordes?"
    a: "No. Obtienes los valores en una cuadrícula limpia, con la fila de encabezado en negrita y columnas de ancho razonable. El formato del PDF no se copia."
  - q: "¿Qué pasa si la tabla sigue en la página siguiente?"
    a: "Con “Todas las páginas en una hoja”, una tabla que continúa con las mismas columnas se une en una sola lista, se quita el encabezado repetido y se omiten los pies de página intermedios."
  - q: "¿Funciona en iPhone y Android?"
    a: "Sí. Abre esta página en Safari o Chrome, elige el PDF desde Archivos o Descargas y guarda el .xlsx. También lo abren Google Sheets y Numbers."
limits:
  - label: Precio
    value: Gratis. Sin cuenta, sin marca de agua y sin límite de páginas.
  - label: Dónde funciona
    value: En tu navegador. El PDF nunca sale de tu dispositivo.
  - label: Funciona mejor con
    value: PDF con tablas de texto real, como estados de cuenta bancarios, facturas e informes exportados desde un programa.
  - label: No compatible
    value: Páginas escaneadas o fotografiadas (usa OCR PDF primero), texto girado y PDF protegidos con contraseña.
  - label: Resultado
    value: Un archivo .xlsx, con todas las páginas en una hoja o una hoja por página.
  - label: Tipos de celda
    value: Los montos pasan a números; las fechas ISO (2026-03-15) y del tipo 15 Mar 2026, a fechas; el resto queda como texto.
  - label: Lo que se pierde
    value: Celdas combinadas, colores, bordes, fuentes e imágenes.
  - label: Velocidad
    value: Cerca de 1 segundo para un estado de cuenta de 2 páginas; uno de 45 páginas y 2,000 filas tardó unos 1.6 segundos en nuestras pruebas.
howto:
  question: "¿Cómo convierto una tabla de un PDF a Excel?"
  steps:
    - name: "Agrega tu PDF"
      text: "Suelta el archivo en el recuadro de arriba o tócalo para elegirlo. Verás cuántas páginas tiene en cuanto se cargue."
    - name: "Elige cómo repartir las páginas"
      text: "Usa “Todas las páginas en una hoja” para un estado de cuenta de varias páginas, o “Una hoja por página” para mantenerlas separadas."
    - name: "Decide qué hacer con el texto alrededor de la tabla (el paso que más se olvida)"
      text: "Por defecto solo se exportan las tablas. Marca la casilla si también quieres títulos, datos de la cuenta o notas en la hoja."
    - name: "Convierte y revisa la vista previa"
      text: "Pulsa Convertir a Excel. Las primeras filas aparecen en una vista previa; comprueba que las columnas cuadren antes de usar los datos."
    - name: "Descarga el .xlsx"
      text: "Pulsa el botón de descarga y abre el archivo en Excel, Google Sheets, Numbers o LibreOffice."
---

## ¿Cómo paso un estado de cuenta bancario de PDF a Excel?

Descarga el estado de cuenta desde la banca en línea como PDF (no como foto ni escaneo), suéltalo aquí y deja marcada la opción “Todas las páginas en una hoja”. La herramienta encuentra la tabla de movimientos en cada página, une las páginas en una sola lista y quita el encabezado que el banco repite arriba de cada hoja. Las fechas en formato ISO se convierten en fechas reales de Excel y cada monto en un número, así que puedes ordenar por importe, filtrar por concepto y sumar cada categoría.

En nuestro estado de cuenta de prueba de 2 páginas (45 movimientos y cinco columnas: fecha, concepto, cargo, abono y saldo) el resultado fueron exactamente 45 filas bajo un encabezado en negrita, con los 45 saldos como celdas numéricas. Compara el saldo final con el del PDF antes de confiar en los totales: si una columna se leyó mal, ahí se nota primero.

## ¿Cómo detecta las columnas el convertidor de PDF a Excel?

Un PDF digital guarda cada fragmento de texto con su posición en la página. El convertidor agrupa en filas el texto que está a la misma altura y luego busca los espacios verticales que quedan vacíos en casi todas esas filas: esos espacios son los límites entre columnas. Un encabezado centrado sobre una columna se asigna a la columna real más cercana, y un concepto que ocupa dos líneas se vuelve a unir con su fila cuando el espaciado lo deja claro.

Esto funciona bien con tablas generadas por un programa (sistemas bancarios, software contable, hojas de cálculo guardadas como PDF). Falla más cuando las columnas no están alineadas, cuando una celda abarca varias columnas o cuando el texto está girado.

## ¿Se puede convertir un PDF a Excel sin instalar programas?

Sí. No necesitas Adobe Acrobat, el asistente de importación de Excel ni un convertidor en línea que suba tu archivo a otro servidor. Esta página funciona en el navegador que ya tienes y crea el .xlsx en tu dispositivo. Eso importa con documentos que prefieres no entregar a terceros: recibos de nómina, formularios fiscales y estados de cuenta.

Si el PDF es enorme, puedes [dividirlo](/es/dividir-pdf) primero y convertir solo las páginas con la tabla. Para enviar el PDF original por correo, [comprímelo](/es/comprimir-pdf); para juntar varios estados de cuenta en un solo documento, usa [Unir PDF](/es/unir-pdf).

## Comparación con otras formas de pasar un PDF a Excel

| Método | ¿Sube tu archivo? | Montos como números | Escaneos | Costo |
| --- | --- | --- | --- | --- |
| Esta página | No | Sí | No, primero OCR | Gratis |
| Copiar y pegar desde el visor de PDF | No | Suele pegarse como texto en una columna | No | Gratis |
| Excel "Obtener datos desde PDF" (Windows) | No | Sí | No | Suscripción a Microsoft 365 |
| Exportar con Adobe Acrobat | Depende de la versión | Sí | Sí, con OCR | Suscripción de pago |
| Convertidores en línea típicos | Sí, a su servidor | Normalmente | Algunos | Gratis con límites |

## Cuándo conviene pasar tablas de PDF a Excel

### Estados de cuenta para tu presupuesto

Muchos bancos solo entregan los estados de cuenta anteriores en PDF. Convierte los de todo el año, pega las filas en tu plantilla de presupuesto de Google Sheets o Excel y clasifica tus gastos con un filtro en lugar de copiar línea por línea.

### Movimientos para tu contador en la temporada de impuestos

Para la declaración de impuestos, los contadores suelen pedir los movimientos en una hoja de cálculo, no doce archivos PDF. Convierte cada estado de cuenta, junta las hojas y envía un solo .xlsx con los gastos deducibles marcados en una columna aparte.

### Facturas de proveedores para la contabilidad

Las partidas de una factura en PDF (artículo, cantidad, precio unitario, total) salen como una tabla pequeña que puedes pegar en las plantillas de importación de QuickBooks, Xero, Alegra o en tu propio registro de compras.

### Informes con cifras que quieres graficar

Informes anuales, listas de precios y estadísticas oficiales a menudo se publican solo en PDF. Extrae las tablas y grafícalas o compáralas en una hoja de cálculo.

## Problemas frecuentes y soluciones

| Problema | Solución | Por qué pasa |
| --- | --- | --- |
| Aviso de “sin texto seleccionable” | Pasa el PDF por OCR PDF y convierte aquí el archivo resultante. | La página es una imagen (escaneo o foto), así que no hay texto para las celdas. |
| “No se encontraron tablas” | Marca “Exportar también el texto fuera de las tablas”. | El texto no está ordenado en columnas alineadas. |
| Dos columnas quedaron juntas | Prueba “Una hoja por página” o sepáralas en Excel con Texto en columnas. | El espacio entre ambas columnas es muy estrecho o lo cruza texto largo. |
| Los números quedaron como texto | Revisa símbolos o espacios raros; la función VALOR de Excel corrige el resto. | Solo se convierten formatos de monto claros; códigos como 00123 conservan sus ceros. |
| Las fechas quedaron como texto | Usa FECHANUMERO o Texto en columnas indicando el orden de día y mes. | 03/04/2026 puede ser 3 de abril o 4 de marzo, así que solo se convierten fechas sin ambigüedad. |
| Una fila salió partida en dos | Une las dos celdas a mano; suele ser un concepto que ocupaba dos líneas. | La segunda línea tenía el espaciado de una fila nueva. |
| Error de contraseña | Ábrelo con la contraseña, guarda una copia sin protección y vuelve a intentarlo. | Un PDF con contraseña de apertura no se puede leer sin ella. |
