# Proveedores de pago — BKLN Marketplace

> Preparación de la fase 3 (pagos dentro de la app, ALCANCE §8). Investigado el 2026-11-03 con fuentes públicas: hay que confirmarlo todo con cada proveedor.
> **Objetivo del primer contacto:** que nos conozcan como desarrolladores y saber si podemos cobrar **Premium** desde la web con su servicio, con la confirmación automática del pago. Los pagos entre compradores y vendedores irían después.

## Resumen

| | Rosa Money | Muni Dinero | Bonafide Microbank |
|---|---|---|---|
| **Qué es** | Empresa de envíos de dinero dentro de Guinea Ecuatorial (ROSA MONEY GE S.L.), con agencias en Malabo y Bata y app móvil | El monedero móvil de **Muni** (operador de telefonía), gestionado por Muni Dinero S.A. Funciona con cualquier móvil (código \*423#) | Microfinanciera de categoría 2 supervisada por la COBAC desde 2018. Su app **B-Morï** sirve para enviar y recibir dinero, también a otros países de la CEMAC, dentro de **GIMACPAY** |
| **Lo que nos interesa** | Su web habla de "pagos comerciales", pero no cuenta nada de cuentas para empresas ni de API | Tiene la figura de **Aceptador de pagos** ("recibe todos tus pagos al instante en una sola cuenta") y cuentas de pagos masivos para empresas. No hay API pública | B-Morï y GIMACPAY: un pago desde B-Morï podría llegar a otros monederos de la CEMAC. GIMAC admite fintech como agregadores |
| **Contacto** | rosamoneyge@gmail.com · +240 222 89 08 11 · +240 555 87 64 54 · L–V 8:00–17:00, S 10:00–17:00 | **corporate@munidinero.com** (empresas) · atencionalcliente@munidinero.com · +240 550 000 423 (también WhatsApp) · Edificio Abayak, 6.ª planta, Malabo II | No se encontró email público. Su web bloquea las lecturas automáticas: hay que abrirla en el navegador (formulario o email). También en LinkedIn y en X (@BMicrobank) |
| **Estado** | Por contactar | Por contactar | Por contactar (falta el email) |

## Qué preguntar a los tres

1. ¿Tienen una cuenta de comercio o empresa para cobrar en línea?
2. ¿Hay **API** o algún método para que la web lance el cobro y se entere sola de que se ha pagado (aviso al servidor o consulta del estado)? ¿Hay entorno de pruebas y documentación?
3. Requisitos (documentos de la empresa, contrato), comisiones y plazos para abonar el dinero.
4. ¿Con quién hablamos para la parte técnica?

## Correos

Se envían desde **hello@bklnsoftware.tech**. Hay que poner el nombre de quien firma.

### Rosa Money — rosamoneyge@gmail.com

**Asunto:** Integrar Rosa Money como forma de pago en BKLN Marketplace

> Buenos días:
>
> Les escribimos desde BKLN Software & Systems, una empresa de desarrollo de software con oficina en Banapa, Malabo. Estamos terminando BKLN Marketplace (bklnmarketplace.com), una web de anuncios clasificados para comprar y vender en toda Guinea Ecuatorial.
>
> Nos gustaría ofrecer Rosa Money como forma de pago dentro de la plataforma. Empezaríamos por el plan Premium de los vendedores (de 5.000 a 33.000 FCFA según el periodo), que hoy se paga en nuestra oficina o por agencia, y más adelante quizá los pagos entre compradores y vendedores.
>
> Somos los programadores de la plataforma, así que nos interesa sobre todo la parte técnica:
>
> - ¿Ofrecen una cuenta para empresas o comercios que cobran en línea?
> - ¿Disponen de una API o de otro sistema para que nuestra web inicie un cobro y reciba la confirmación del pago de forma automática? ¿Tienen documentación o un entorno de pruebas?
> - ¿Qué requisitos, comisiones y plazos de abono tendríamos?
>
> Si les parece bien, podemos pasar por sus oficinas de Malabo para conocernos. Gracias por su tiempo.
>
> Un saludo,
>
> [Nombre y apellidos]
> BKLN Software & Systems · Banapa, Malabo
> hello@bklnsoftware.tech · +240 555 220 846
> bklnsoftware.tech · bklnmarketplace.com

### Muni Dinero — corporate@munidinero.com (con copia a atencionalcliente@munidinero.com)

**Asunto:** Cobros con Muni Dinero en BKLN Marketplace (aceptador de pagos e integración)

> Buenos días:
>
> Les escribimos desde BKLN Software & Systems, una empresa de desarrollo de software con oficina en Banapa, Malabo. Estamos terminando BKLN Marketplace (bklnmarketplace.com), una web de anuncios clasificados para comprar y vender en toda Guinea Ecuatorial.
>
> Queremos que nuestros usuarios puedan pagar con Muni Dinero dentro de la plataforma. Empezaríamos por el plan Premium de los vendedores (de 5.000 a 33.000 FCFA según el periodo), que hoy se paga en nuestra oficina o por agencia, y más adelante quizá los pagos entre compradores y vendedores.
>
> Hemos visto en su web la opción de Aceptador de pagos. Como somos los programadores de la plataforma, nos interesa saber:
>
> - Si, además de la cuenta de aceptador, tienen una API o algún sistema para que nuestra web inicie el cobro (por ejemplo, con una solicitud que el cliente confirma en su móvil) y reciba la confirmación del pago de forma automática.
> - Si hay documentación técnica o un entorno de pruebas.
> - Qué requisitos, comisiones y plazos de abono tendríamos.
>
> Podemos pasar por sus oficinas del Edificio Abayak cuando les venga bien. Gracias por su tiempo.
>
> Un saludo,
>
> [Nombre y apellidos]
> BKLN Software & Systems · Banapa, Malabo
> hello@bklnsoftware.tech · +240 555 220 846
> bklnsoftware.tech · bklnmarketplace.com

### Bonafide Microbank — email por confirmar (formulario de bonafidemicrobank.com o LinkedIn)

**Asunto:** Integrar B-Morï como forma de pago en BKLN Marketplace

> Buenos días:
>
> Les escribimos desde BKLN Software & Systems, una empresa de desarrollo de software con oficina en Banapa, Malabo. Estamos terminando BKLN Marketplace (bklnmarketplace.com), una web de anuncios clasificados para comprar y vender en toda Guinea Ecuatorial.
>
> Nos gustaría ofrecer B-Morï como forma de pago dentro de la plataforma. Empezaríamos por el plan Premium de los vendedores (de 5.000 a 33.000 FCFA según el periodo), que hoy se paga en nuestra oficina o por agencia, y más adelante quizá los pagos entre compradores y vendedores. Nos interesa también que, por GIMACPAY, puedan pagar usuarios de otros monederos.
>
> Somos los programadores de la plataforma, así que nos interesa sobre todo la parte técnica:
>
> - ¿Ofrecen una cuenta para comercios que cobran en línea con B-Morï?
> - ¿Disponen de una API o de otro sistema para que nuestra web inicie un cobro y reciba la confirmación del pago de forma automática? ¿Tienen documentación o un entorno de pruebas?
> - ¿Qué requisitos, comisiones y plazos de abono tendríamos?
>
> Si les parece bien, podemos pasar por su oficina para conocernos. Gracias por su tiempo.
>
> Un saludo,
>
> [Nombre y apellidos]
> BKLN Software & Systems · Banapa, Malabo
> hello@bklnsoftware.tech · +240 555 220 846
> bklnsoftware.tech · bklnmarketplace.com

## Fuentes

- Rosa Money: [contacto](https://rosamoney.com/contact), [web](https://rosamoney.com/), [Google Play](https://play.google.com/store/apps/dev?id=8171176123062982156&hl=es_419), [App Store](https://apps.apple.com/es/app/rosa-money/id6738861811).
- Muni Dinero: [web](https://www.munidinero.com/en/), [contacto](https://www.munidinero.com/en/contact-us/), [socios y aceptadores de pagos](https://www.munidinero.com/en/business-partnerships/), [Muni](https://www.muni-eg.com/en/).
- Bonafide Microbank: [web](https://bonafidemicrobank.com/), [LinkedIn](https://gq.linkedin.com/company/bonafide-microbank), [app B-Morï](https://apps.apple.com/mx/app/b-mor%C3%AF/id6476767430), [alianza con Ecobank (2022)](https://www.guineainfomarket.com/economia/2022/07/20/ecobank-guinea-ecuatorial-se-asocia-con-bonafide-microbank-donn-grupo-y-oms-business-para-el-lanzamiento-de-los-puntos-xpress/).
- GIMACPAY: [Financial Afrik](https://www.financialafrik.com/2020/07/13/zone-cemac-le-gimac-lance-le-service-monetique-integral/).
