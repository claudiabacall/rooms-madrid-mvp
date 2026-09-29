import fs from 'node:fs';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import process from 'node:process';

const APPLY = process.argv.includes('--apply');
const BATCH = 'alpha_2026_09';

const configText = fs.readFileSync(
  'assets/js/supabase-config.js',
  'utf8'
);

const supabaseUrl =
  configText.match(/url:\s*['"]([^'"]+)['"]/)?.[1]?.replace(/\/$/, '');

if (!supabaseUrl) {
  throw new Error(
    'No encuentro la URL de Supabase en assets/js/supabase-config.js'
  );
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (APPLY && !serviceKey) {
  throw new Error(
    'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.'
  );
}

/* =========================================================
   IMAGENES DE VIVIENDA
   ========================================================= */

const bedrooms = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRnMn-pPMBavjzUyhWcwJWDYss573HPHSCdG8vhMu1AVA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR8vTLCZnYES2WRBIt8YxGY74-AD400ypTM-vv40VtJxg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTkngbajrBb0eUpoe_puHpH8f41K7AqnlgkEirqc_FwIQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpieVOx-jJDOyPQQ1Nbg_b6ifmQLKZX_j3YF52Yuni0A&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRYjjyqlUfnW8QjSK02kD7EDhykP_e3EhbuGG8zhfzF8Q&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ564ivoMMPDBoiGcRRy1U5C5IguT5foLZz8QnFPThssw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ5yPxtbOKqXRr-lCyQ1aOD06pm7PBVpVIQUYBWKuSUNQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_CwgcegpTd_cypSjLs11iHgQhWHUsgOYlb-l8EEpeNw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_A0bETx1NyEUgzDuKDnTWzFiMAay-XMxGm_c5yjItJA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6LJAY8Eppn9QHpQIgJaoxuiDyTF4FM22T0IKgNxPFtg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ6Ss1yAbcfHn0Vs7oO2C_CJEXc3yld2779QsMQeT71FA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNkoEfgQBAtZsay8cr3Khqbt4V4Sp728dbEhGmOtBRXA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSO-3SrYkF7wCwxCvQVhc1InFOATt0ZRLYgnP_3sdk4ZQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ4YB44t-fr5_dyORJTupLq4_uS1OtK9bju25DqbuWx5g&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRcvMPzP0yjCeIErv_BvZvknkgGvCBagAspHKcCejvtcA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ5FRfI1UtI3aEk0t4y960wzlQEbX1m8Ii1oJ44_fohSA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_GfjUJysCjRD6pbeubpQpOl2Pdb150tqutXrP-sFIZw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwuBpcWAFmJO9PoLM43-0HZ6ehjNW8wqMpEM6W7vm_vQ&s',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGb37bChxmp8QoIgajn6zUf0qbQxQeGERNnyxXSXOgDA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_IWHuVb5UPZGDpt1RUdGBQQvTLiVDvg5S6MN8tkcYaA&s=10'
];

const livingRooms = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNUxpWjM7rQNHYdFvEQyu-H9eaV-pnITpy69zP3lGbxw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT77iQbv6K9lRSGUF4_E6OK98StYNR2Pt48EHtIfoFnAg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9Oll8tpFJMb4KEmkAi5A4kD0jNM2OhdHC4JRpxtkR1g&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTFcGlnQ8KslX3EIWyF-wq5fymOm0NsmqN-b1WxUjFd9w&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRO45uMe1rH2n5gXRBDYGYH2w_BjqRrL82RqM84du9xEw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6YXMLKENqHjXJK9gLWh7MUKbKD1588WzSQ3lNBVvFqg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQpcg2dnuT8NMdtiGoIs1ZZOkFrgi-j8kmzZUqJ8J1zlw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmk6VfBV07Tj-ByQeXuFEL4C8-MSc08i2TxLNkfv4-tQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQR9rZ7XSF_79JU7ts9_I6FFuJm2OnI7mp9wY9oqwviIg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTkCqWzQ1tN1M0rS0_CZManxljhMMlE9rJxaaNXXaU-bw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXP9N3Tf2VaMjIEdcer_AiehQZsjFq5QwsUvpQk_dlYg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLwj2sctfpZMR0mc4n4Dt1eIdtvYWzD0PeBWnPA2GyDg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRomq1qiMAZui6WyUsvSAijC52uGOFho9y5DuxSKYWXCw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSiTR3GWSsIuaT9jP6qqskLgVEXEuCuwlzIWA5PVdaAtQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRzXT7qle6ebu66EhWApUg_O218yOi1-neyhf_Vw7IOjA&s=10'
];

const kitchens = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTxw41kPSXU0suVtT4CyEHqt1aNK9ZVk3lWIrBKZRTgQg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ4B3IfbldXqFTjxgaDCfMDpk4XjhdvJMQ1mlxSrEcbDw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSPBIZxWg0EcH88kkwWxLFH-GxeMiCHp_CoNHHNPytteg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRd5JkO0Wgc79mrQ3X6UkQqDs179KDb5Zf9HjMY-hAoJQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBwWPOkXn-_U48Td8WrfSv6YgKImgmXK6W8wzBrxvHWw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQ4xnQd3pPdMtSv1XkXeMhGrxf4Z_qJNh5MwklqIVfHQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBDrQtbfoPFM0DFE5ec8qmlzgqaT9Oz0Y2ri76E_agqA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSZwGccXQsGm5vr23ZS95QrahzhlY2-9sS-7kA-weTmXQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSBDSAiXWzId9hrkuXm_MvjaR_zLtp_3pQMEJl16A9q5w&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTslu7I6nZv3fUp8gHegOO8wKO5yi068A_M0BJpr2EVCA&s=10'
];

const bathrooms = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT5Lmnh-9Mhxw7hiSwONfzeArvTKuDylaZM3J7Jp1hsJg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSRc80N_8Ivj-pz2DE8MDZyVMM123ZM3lP_VDuZjLiW4g&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSw095yZ7k2TeZhDGoTy3APKFUW_f-VqfRgg7vGdzh-gg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVy7p6X5rmHdmFKYWpNiD9vyOMcqP7CXUTo-548ythHg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR0wEYqwY4SUvfmoP7gq-oC7MQuiHW4dQaYOs6SG2KnKw&s=10'
];

const terraces = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZ_qV8lesM0sfSXJ3KCTMf8f0K4kce7GkdUBFOBz6f_w&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTND9GbFe9ZRnFKhjFUhSWZgVyb2YphL9RTC01xXnbmA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRfSuGXsS4mgs5S6sLDdXZx-3t2UOCRjgOmMEQudXG6KQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRavocsnKWeAeaoLBSBopNkeh2EvAI2O8_i-OBMXUki8A&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcScV1ffyrGR3rk03V67FcJobJAXnIQHKxWlzQIv2jajVA&s=10'
];

const commonAreas = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-7NdRoSUs_kUtP2f6jG5bJH6KzS97fNIomQywqCIbBg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRDrr65nphyNdVfRrn1RmIe6kEeOhpsZ348NR7Zigt5Vg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQbecxwaQn_C1CeLCeMikrvs5mMd5uALHCNnDvem_PIVQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOFn_ED0fmY8-67HSIejDGt_7kAKLQRE5b0vUFvLzWMw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSSX-k7fWYLYXt2g0uuBUnchiWkrc-92I-Y6hyNLKdZDg&s=10'
];

/* =========================================================
   AVATARES
   ========================================================= */

const maleAvatars = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ8vDWtL37z13bcpJeTTDHwEgDuuckptMi_4n6dNbmpjQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBvq26wOg0Zi4H-gLYQKJsHN1IhEoteb3j2cn9u__ifA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTb2f4buqWSxIszamy0MUHguqd5xJsbakZzQyUA0i_Pfg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnahfNzM4iuIOnLowx6NRFYJc0R1ZxC1APTuo-D73N0g&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDe0bdyli6sHDz82aW17sCjHP23OtFVJhUb9I6uIFypw&s',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkfZQsv7gIRhjY45UNeteKzf9ugxNXGk0Zqdyuc0C8Bg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREH4l1VlieXB-z-6vcaXh0JXQqepNn8FC9KFQoWikeUw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSACg4CQKNk8LG4jp8A6N-SH0nWsMhwUN6Wm6vP4oyWQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRewNsPxU-MptI2bcMFPaOUuDJOKxq70q9C2qFCvTk-mw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-GDda1cASOpbztlrVBRyJHw0INxqHn_U0oSnDs17wDw&s=10'
];

const femaleAvatars = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQKnyggmyZFcjzLCF8jZAHMVmVRdtIP8x_KN8YHbQHA9A&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRYjoR0CkS1HN2mR5sbbRKcnCnXsRn9y_zJ7dwSBdqc4Q&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfarKCzFYFItDBqyE9lnOPgtCVCksB0LB0r08tjwfOQQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTUb06u5s9YHnF7ECVsLcNPrVizrTqraLBNLvwwSQpWvA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQreWVfQRReovajT787aFRo7nRNBhswg-5Cb3t5MTPkvw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBV70di4rj8Uxv9Lak8Y1j9LVky-kE3gUrOz7VIN2vKg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSNtNZbZeWXVtCHrSCzhrTkvxEkLYmZa-KHdRUtiH87LQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTpfKqFUKDoGq0TKLmEB_v0Jscrv8se93OARC24io2ulA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpYcMPmy1U20g3k7a3_GV-xa7TjmBrmOux9R8xZ6MOGA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS0guOI6AP7hrb_YA8AlFUzWEFohx-dr-eZUAJrWCP3pQ&s=10'
];

/* =========================================================
   COMUNIDADES
   ========================================================= */

const communityImages = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtli-DBf32wxCNcRHNTqCV_wPhH256WWeM85OJ5OpBhQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQBNRDuxi63WTT0M8V6WV_i3tsTZUM-y_PgQcfwK00apg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSdbu4m2owQNb_zA_0uREdxC_gyXJ2j088TzfiTqMJHww&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT-VJfim87EaWPgUHN5skEt97oBKSlRKE_waIAmwQEfnw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTm8b0x1j2sx16OAtwJcHwGHPjmwPRX1-VnqCDhWF88Yw&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSVYL5yAQ2GPOgz641yLlFVqxhDFDMF7xfSI6508YCtA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRBZ9lbM8VrGfHeo0diGN-01xditnSF3rtWACgHMrAERQ&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJypKbos_95igEIhz8joUaZEmf4nbprEp1nob_n_XbTA&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSIQinrQMMJIPilP1fKW46F0HTBCPV5Y6mv_Oqb2zObQA&s=10',
  'https://www.economiadigital.es/tendenciashoy/wp-content/uploads/sites/7/2024/05/barrio-de-las-letras.jpg'
];

/* =========================================================
   PERSONAS
   ========================================================= */

const people = [
  ['Álvaro', 'Álvaro Ortega', 27, maleAvatars[0]],
  ['Javier', 'Javier Martín', 30, maleAvatars[1]],
  ['Diego', 'Diego León', 25, maleAvatars[2]],
  ['Mateo', 'Mateo Santos', 28, maleAvatars[3]],
  ['Carlos', 'Carlos Romero', 31, maleAvatars[4]],
  ['Gonzalo', 'Gonzalo Vega', 26, maleAvatars[5]],
  ['Pablo', 'Pablo Ruiz', 29, maleAvatars[6]],
  ['Nicolás', 'Nicolás Navarro', 24, maleAvatars[7]],
  ['Álex', 'Álex Moreno', 28, maleAvatars[8]],
  ['Jaime', 'Jaime Castro', 32, maleAvatars[9]],

  ['Lucía', 'Lucía Gil', 26, femaleAvatars[0]],
  ['Marta', 'Marta Molina', 24, femaleAvatars[1]],
  ['Sofía', 'Sofía Prieto', 29, femaleAvatars[2]],
  ['Elena', 'Elena Rey', 27, femaleAvatars[3]],
  ['Paula', 'Paula Blanco', 25, femaleAvatars[4]],
  ['Carmen', 'Carmen Suárez', 31, femaleAvatars[5]],
  ['Irene', 'Irene Iglesias', 28, femaleAvatars[6]],
  ['Alejandra', 'Alejandra Cano', 23, femaleAvatars[7]],
  ['Marina', 'Marina Vidal', 30, femaleAvatars[8]],
  ['Clara', 'Clara Pastor', 27, femaleAvatars[9]]
];

const bios = [
  'Trabajo en producto digital. Ordenado entre semana y bastante sociable los findes.',
  'Trabajo híbrido y valoro una casa tranquila, limpia y con buen ambiente.',
  'Me gusta cocinar, hacer deporte y conocer sitios nuevos en Madrid.',
  'Busco una convivencia fácil: cada uno con su espacio, pero con buen rollo.',
  'Teletrabajo algunos días. Valoro mucha luz, metro cerca y poco ruido.',
  'Soy bastante independiente, pero me gusta compartir alguna cena o plan de vez en cuando.',
  'Trabajo en comunicación y llevo horarios bastante normales entre semana.',
  'Muy de deporte, viajes y descubrir restaurantes. En casa, tranquilo.',
  'Recién llegado a Madrid por trabajo. Busco gente maja y una zona bien conectada.',
  'Me gusta mantener los espacios comunes cuidados y respetar los horarios de los demás.'
];

const zoneData = [
  { name: 'Chamberí', lat: 40.4380, lng: -3.7044 },
  { name: 'Salamanca', lat: 40.4270, lng: -3.6788 },
  { name: 'Retiro', lat: 40.4140, lng: -3.6760 },
  { name: 'Chamartín', lat: 40.4610, lng: -3.6770 },
  { name: 'Malasaña', lat: 40.4256, lng: -3.7025 },
  { name: 'Argüelles', lat: 40.4295, lng: -3.7170 },
  { name: 'Lavapiés', lat: 40.4098, lng: -3.7000 },
  { name: 'La Latina', lat: 40.4113, lng: -3.7080 },
  { name: 'Centro', lat: 40.4168, lng: -3.7038 },
  { name: 'Moncloa', lat: 40.4350, lng: -3.7190 }
];

const interestsSets = [
  ['music', 'travel', 'going-out'],
  ['cooking', 'sport', 'travel'],
  ['music', 'cooking'],
  ['sport', 'going-out'],
  ['travel', 'culture'],
  ['cooking', 'culture'],
  ['music', 'sport'],
  ['travel', 'food'],
  ['going-out', 'food'],
  ['sport', 'culture']
];

const traitsSets = [
  ['tidy', 'social'],
  ['independent', 'early'],
  ['tidy', 'independent'],
  ['social', 'easy-going'],
  ['quiet', 'tidy'],
  ['independent', 'easy-going'],
  ['early', 'tidy'],
  ['social', 'independent'],
  ['quiet', 'independent'],
  ['tidy', 'easy-going']
];

const durations = [
  'Flexible',
  '12+',
  'Más de 1 año'
];

const listingFeatures = [
  ['Amueblado', 'Exterior', 'Luz natural', 'Metro cerca'],
  ['Ascensor', 'Exterior', 'Aire acondicionado'],
  ['Terraza', 'Amueblado', 'Metro cerca'],
  ['Teletrabajo', 'Luz natural', 'Ascensor'],
  ['Baño privado', 'Amueblado', 'Exterior'],
  ['Zona tranquila', 'Ascensor', 'Metro cerca'],
  ['Terraza', 'Luz natural', 'Aire acondicionado'],
  ['Exterior', 'Teletrabajo', 'Almacenamiento']
];

const communityDefinitions = [
  ['Chamberí', 'Para quienes viven o buscan casa en Chamberí. Pisos, planes y recomendaciones del barrio.'],
  ['Salamanca', 'Vivienda, recomendaciones y vida de barrio en Salamanca.'],
  ['Malasaña', 'Pisos, habitaciones y planes alrededor de Malasaña.'],
  ['Retiro', 'Para quienes buscan vivir cerca de Retiro y sus alrededores.'],
  ['Chamartín', 'Comunidad para compartir vivienda, dudas y recomendaciones de Chamartín.'],
  ['Argüelles & Moncloa', 'Habitaciones, pisos y vida por Argüelles y Moncloa.'],
  ['Erasmus Madrid', 'Personas recién llegadas a Madrid, estudiantes y gente internacional.'],
  ['Jóvenes profesionales', 'Para quienes trabajan en Madrid y buscan piso o compañeros.'],
  ['Teletrabajo Madrid', 'Casas, zonas y convivencia para quienes trabajan desde casa.'],
  ['Madrid Centro', 'Todo sobre vivir en Centro, La Latina, Lavapiés y alrededores.']
];

const postBodies = [
  ['question', '¿Qué zonas recomendaríais para vivir bien conectado con Nuevos Ministerios sin pagar una barbaridad?'],
  ['recommendation', 'Descubrí una cafetería muy tranquila para trabajar por Chamberí. Tiene mesas grandes y wifi bastante decente.'],
  ['neighborhood', 'Llevo unas semanas viviendo por Argüelles y me está sorprendiendo para bien. Todo bastante cerca y mucho ambiente.'],
  ['experience', 'Me mudé a Madrid hace poco y buscar habitación fue bastante más fácil cuando empecé a mirar por zonas y no solo por precio.'],
  ['warning', 'Ojo con reservar una habitación sin verla o sin comprobar bien quién la publica. Mejor revisar todo antes de pagar nada.'],
  ['question', '¿Alguien vive por Retiro y teletrabaja? ¿Qué tal de ruido durante el día?'],
  ['recommendation', 'Para quien esté mirando Chamberí: la zona entre Quevedo y Canal me parece muy cómoda para moverse.'],
  ['experience', 'Compartir piso me está funcionando mucho mejor desde que acordamos limpieza y visitas desde el principio.'],
  ['neighborhood', 'Malasaña tiene muchísimo ambiente, pero cambia bastante de una calle a otra. Conviene visitar la zona también de noche.'],
  ['question', '¿Qué presupuesto os parece realista para una habitación exterior por Salamanca o Retiro?'],
  ['recommendation', 'Si buscáis zona tranquila pero céntrica, echaría un vistazo a Ibiza y Niño Jesús.'],
  ['experience', 'Para mí la luz natural terminó siendo más importante que tener un salón enorme.'],
  ['question', '¿Preferís pagar algo más por baño privado o ahorrar y compartirlo?'],
  ['neighborhood', 'Lavapiés sigue teniendo opciones interesantes si quieres estar andando del centro y tener mucha vida alrededor.'],
  ['recommendation', 'Miraría siempre la distancia andando al metro además de lo que diga el anuncio. Cambia muchísimo el día a día.'],
  ['question', '¿Hay alguien buscando compañero para entrar en piso en noviembre?'],
  ['experience', 'Conocer a los compañeros antes de entrar me parece casi tan importante como visitar el piso.'],
  ['question', '¿Qué tal Chamartín para alguien que trabaja por Castellana?'],
  ['recommendation', 'Para teletrabajar, una habitación con escritorio de verdad cambia bastante la experiencia.'],
  ['neighborhood', 'La Latina los domingos tiene muchísimo movimiento. Si buscas silencio, mejor comprobar la calle concreta.'],
  ['question', '¿Qué cosas preguntáis siempre en una visita de piso?'],
  ['experience', 'En mi último piso hicimos una pequeña lista de normas desde el primer día y evitó bastantes líos.'],
  ['recommendation', 'Si la fecha de entrada es flexible, merece la pena indicarlo. Aparecen bastantes más opciones.'],
  ['question', '¿Alguien conoce gimnasios buenos por Chamberí que no estén llenísimos por la tarde?'],
  ['neighborhood', 'Argüelles me parece especialmente cómoda si estudias o trabajas por Moncloa y además quieres bajar andando al centro.'],
  ['experience', 'Vivir con gente que tiene horarios parecidos a los tuyos se nota muchísimo más de lo que pensaba.'],
  ['recommendation', 'Para compartir piso, intentaría que haya suficiente espacio de almacenamiento en las zonas comunes.'],
  ['question', '¿Qué preferís: terraza pequeña o salón más grande?'],
  ['experience', 'He tenido buena experiencia viviendo con gente que conocí poco antes de entrar; hablar claro al principio ayuda mucho.'],
  ['neighborhood', 'Salamanca es bastante cómoda para moverse, pero los precios cambian muchísimo incluso entre calles cercanas.'],
  ['question', '¿Alguno está buscando piso completo entre dos o tres personas?'],
  ['recommendation', 'Antes de descartar un barrio, miraría también las líneas de bus. En algunas zonas solucionan muchísimo.'],
  ['experience', 'Mi prioridad era estar en Centro y al final elegí Chamberí. Estoy tardando parecido al trabajo y duermo bastante mejor.'],
  ['question', '¿Qué zonas miraríais para alguien que llega por primera vez a Madrid?'],
  ['neighborhood', 'Retiro tiene zonas muy residenciales y otras con bastante vida. Merece la pena recorrerlo antes de decidir.'],
  ['recommendation', 'Si vais a teletrabajar varios en casa, preguntaría siempre por fibra y por dónde estaría cada escritorio.'],
  ['question', '¿Mascotas en piso compartido sí o no?'],
  ['experience', 'Una videollamada antes de quedar para visitar el piso me ahorró varias visitas que no encajaban nada.'],
  ['neighborhood', 'Por Tribunal y Noviciado hay mucha oferta, pero también bastante ruido dependiendo de la calle.'],
  ['recommendation', 'Tener supermercado y metro cerca acaba importando más en el día a día que muchos extras del piso.'],
  ['question', '¿Alguien más busca mudarse en octubre o noviembre?'],
  ['experience', 'Mi mejor experiencia compartiendo fue con personas bastante independientes pero que cuidaban mucho las zonas comunes.'],
  ['recommendation', 'Para una habitación pequeña, que sea exterior y tenga buena luz puede hacer que se sienta mucho más amplia.'],
  ['question', '¿Qué opináis de compartir gastos comunes con una app desde el primer día?'],
  ['neighborhood', 'Chamberí sigue siendo de mis zonas favoritas porque puedes hacer muchísimas cosas andando.'],
  ['experience', 'No pensé que me importaría tanto tener ascensor hasta que me mudé a un cuarto sin él.'],
  ['recommendation', 'Si vas a visitar un piso, intenta ir a la hora a la que normalmente volverías del trabajo. Ves mejor el ambiente real.'],
  ['question', '¿Qué tal vivir por Pacífico si tienes que ir todos los días al centro?'],
  ['experience', 'Después de varios pisos compartidos, para mí lo principal es que todos tengan expectativas parecidas sobre visitas y ruido.'],
  ['recommendation', 'Guardar varias opciones y compararlas al día siguiente ayuda a no decidir solo por la emoción de la visita.']
];

/* =========================================================
   HELPERS
   ========================================================= */

function randomPassword() {
  return crypto.randomBytes(32).toString('base64url');
}

function isoDaysAgo(days, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function photosFor(index) {
  return [
    bedrooms[index % bedrooms.length],
    livingRooms[index % livingRooms.length],
    kitchens[index % kitchens.length],
    index % 3 === 0
      ? terraces[index % terraces.length]
      : bathrooms[index % bathrooms.length],
    ...(index % 5 === 0
      ? [commonAreas[index % commonAreas.length]]
      : [])
  ];
}

function jitter(value, index, scale = 0.003) {
  const direction = index % 2 === 0 ? 1 : -1;
  const amount = ((index % 7) + 1) * scale / 7;
  return Number((value + direction * amount).toFixed(6));
}

async function request(path, options = {}) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(
    `${supabaseUrl}${path}`,
    {
      ...options,
      headers
    }
  );

  const raw = await res.text();

  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!res.ok) {
    console.error('\nERROR API');
    console.error(path);
    console.error(data);

    throw new Error(
      `${res.status} ${res.statusText}`
    );
  }

  return data;
}

async function insertRows(table, rows, upsert = false) {
  return request(
    `/rest/v1/${table}`,
    {
      method: 'POST',
      headers: {
        Prefer: upsert
          ? 'resolution=merge-duplicates,return=representation'
          : 'return=representation'
      },
      body: JSON.stringify(rows)
    }
  );
}

async function createAuthUser(index, person) {
  const [alias, name] = person;

  const email =
    `alpha.rooms.${String(index + 1).padStart(2, '0')}@example.com`;

  const data = await request(
    '/auth/v1/admin/users',
    {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          seed_batch: BATCH,
          seed: true,
          alias,
          name
        }
      })
    }
  );

  return data;
}

/* =========================================================
   GENERADORES
   ========================================================= */

function makeProfile(user, person, index) {
  const [alias, name, age, avatar] = person;

  const z1 = zoneData[index % zoneData.length].name;
  const z2 = zoneData[(index + 3) % zoneData.length].name;

  const min = 550 + (index % 6) * 100;
  const max = min + 450 + (index % 4) * 100;

  return {
    id: user.id,
    name,
    alias,
    avatar_url: avatar,
    bio: bios[index % bios.length],
    age,
    seeking:
      index % 3 === 0
        ? ['room', 'mates']
        : index % 3 === 1
          ? ['home']
          : ['room'],
    zones: [z1, z2],
    budget_min: min,
    budget_max: max,
    move_in_date: futureDate(7 + (index % 8) * 7),
    duration: durations[index % durations.length],
    interests: interestsSets[index % interestsSets.length],
    traits: traitsSets[index % traitsSets.length],
    onboarding_completed: true,
    created_at: isoDaysAgo(40 - index),
    updated_at: isoDaysAgo(Math.max(0, 5 - (index % 6)))
  };
}

function makePreferences(user, profile, index) {
  const livingVariants = [
    {
      '0': { option: 0 },
      '1': { option: 0 },
      '2': { option: 1 },
      '6': { option: 0 },
      '7': { option: 1 }
    },
    {
      '0': { option: 1 },
      '1': { option: 0 },
      '2': { option: 0 },
      '6': { option: 1 },
      '7': { option: 0 }
    },
    {
      '0': { option: 0 },
      '1': { option: 1 },
      '2': { option: 1 },
      '6': { option: 0 },
      '7': { option: 0 }
    },
    {
      '0': { option: 1 },
      '1': { option: 1 },
      '2': { option: 0 },
      '6': { option: 1 },
      '7': { option: 1 }
    }
  ];

  const featureSets = [
    ['outside', 'light', 'lift', 'metro', 'quiet'],
    ['furnished', 'outside', 'workspace', 'air'],
    ['light', 'terrace', 'metro', 'storage'],
    ['lift', 'pets', 'quiet', 'bathroom'],
    ['outside', 'workspace', 'bathroom', 'air']
  ];

  return {
    user_id: user.id,
    answers: {
      move: {
        date: profile.move_in_date,
        duration: profile.duration,
        flexible: index % 4 === 0
      },
      zones: profile.zones,
      budget: {
        min: profile.budget_min,
        max: profile.budget_max,
        over4000: false
      },
      living: livingVariants[index % livingVariants.length],
      social: {
        traits: profile.traits,
        interests: profile.interests
      },
      privacy: {
        level: 'balanced',
        controls: {
          budget: 'connections',
          living: 'public',
          search: 'public',
          activity: 'public'
        }
      },
      seeking: profile.seeking,
      homeFeatures: featureSets[index % featureSets.length]
    },
    updated_at: isoDaysAgo(index % 5)
  };
}

function makeListings(users) {
  const listings = [];

  for (let i = 0; i < 35; i++) {
    const owner = users[i % users.length];
    const zone = zoneData[i % zoneData.length];

    const isRoom = i % 3 !== 0;

    const price = isRoom
      ? 575 + (i % 10) * 65
      : 1250 + (i % 9) * 145;

    const titlesRoom = [
      'Habitación luminosa en piso compartido',
      'Habitación exterior con mucha luz',
      'Habitación tranquila cerca del metro',
      'Habitación amueblada en piso amplio',
      'Habitación exterior en piso reformado',
      'Habitación con escritorio y armario',
      'Habitación en piso con terraza',
      'Habitación amplia y luminosa'
    ];

    const titlesApartment = [
      'Piso luminoso y amueblado',
      'Apartamento exterior bien conectado',
      'Piso reformado con mucha luz',
      'Apartamento tranquilo cerca del metro',
      'Piso amplio para compartir',
      'Apartamento amueblado en buena zona'
    ];

    listings.push({
      id: crypto.randomUUID(),
      owner_id: owner.id,

      /*
       * La app ya tiene "apartment" confirmado en producción.
       * Para evitar introducir un valor de kind que no sepamos
       * si tiene CHECK constraint, mantenemos apartment también
       * en anuncios de habitación durante esta alpha.
       */
      kind: 'apartment',

      title: isRoom
        ? titlesRoom[i % titlesRoom.length]
        : titlesApartment[i % titlesApartment.length],

      zone: zone.name,
      price,
      available_from: futureDate(3 + (i % 12) * 4),
      duration: durations[i % durations.length],
      rooms: isRoom ? 1 : 2 + (i % 3),
      baths: 1 + (i % 2),
      area: isRoom
        ? 12 + (i % 9)
        : 55 + (i % 7) * 9,
      furnished: i % 5 !== 0,
      features: listingFeatures[i % listingFeatures.length],
      photos: photosFor(i),
      description: isRoom
        ? `Habitación disponible en ${zone.name}. Piso cuidado, bien conectado y pensado para una convivencia tranquila.`
        : `Piso disponible en ${zone.name}. Exterior, bien comunicado y con espacios cómodos para el día a día.`,
      source_url: null,
      status: 'published',
      created_at: isoDaysAgo(34 - (i % 34), i % 12),
      updated_at: isoDaysAgo(i % 4),
      latitude: jitter(zone.lat, i),
      longitude: jitter(zone.lng, i + 3),
      location_precision: 'approximate'
    });
  }

  return listings;
}

function makeCommunities(users) {
  return communityDefinitions.map(
    ([name, description], index) => ({
      id: crypto.randomUUID(),
      owner_id: users[index % users.length].id,
      name,
      description,
      image_url: communityImages[index],
      visibility: 'public',
      status: 'active',
      created_at: isoDaysAgo(50 - index * 2),
      updated_at: isoDaysAgo(index % 5)
    })
  );
}

function makePosts(users, communities, listings) {
  return postBodies.map(
    ([post_type, body], index) => {
      const useCommunity = index < 40;

      const linkedListing =
        index % 10 === 0
          ? listings[index % listings.length]
          : null;

      return {
        id: crypto.randomUUID(),
        author_id: users[index % users.length].id,
        post_type,
        body,
        zone:
          zoneData[index % zoneData.length].name,
        listing_id:
          linkedListing?.id || null,
        status: 'published',
        created_at: isoDaysAgo(
          28 - (index % 28),
          index % 18
        ),
        updated_at: isoDaysAgo(index % 3),
        community_id:
          useCommunity
            ? communities[index % communities.length].id
            : null,
        media_urls: [],
        expires_at: null
      };
    }
  );
}

/* =========================================================
   PREVIEW
   ========================================================= */

console.log('');
console.log('ROOMS · SEED ALPHA');
console.log('==================');
console.log(`Lote: ${BATCH}`);
console.log('');
console.log('Se crearán:');
console.log(`- ${people.length} usuarios de Auth`);
console.log(`- ${people.length} perfiles`);
console.log(`- ${people.length} preferencias de onboarding`);
console.log('- 35 viviendas');
console.log('- 10 comunidades');
console.log(`- ${postBodies.length} publicaciones`);
console.log('');
console.log(`Supabase: ${supabaseUrl}`);
console.log('');

if (!APPLY) {
  console.log('DRY RUN · No se ha escrito nada en Supabase.');
  console.log('');
  console.log(
    'Para ejecutar de verdad: node scripts/seed-alpha.mjs --apply'
  );
  process.exit(0);
}

/* =========================================================
   CONFIRMACION
   ========================================================= */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const confirmation = await rl.question(
  'Escribe SEED ALPHA para continuar: '
);

rl.close();

if (confirmation.trim() !== 'SEED ALPHA') {
  console.log('Cancelado. No se ha modificado Supabase.');
  process.exit(0);
}

/* =========================================================
   PRECHECK: EVITAR DUPLICADOS
   ========================================================= */

console.log('');
console.log('Comprobando que el lote no exista...');

const existingUsers = await request(
  '/auth/v1/admin/users?page=1&per_page=1000'
);

const authUsers = Array.isArray(existingUsers)
  ? existingUsers
  : existingUsers?.users || [];

const previousSeedUsers = authUsers
  .filter(
    user =>
      user?.user_metadata?.seed_batch === BATCH
  )
  .sort((a, b) =>
    String(a.email || '').localeCompare(String(b.email || ''))
  );

let users = [];

if (previousSeedUsers.length === people.length) {
  console.log(
    `Reutilizando ${previousSeedUsers.length} usuarios sintéticos ya creados...`
  );
  users = previousSeedUsers;
} else if (previousSeedUsers.length === 0) {
  console.log('Creando usuarios sintéticos...');

  for (let i = 0; i < people.length; i++) {
    const user = await createAuthUser(i, people[i]);
    users.push(user);

    process.stdout.write(
      `  ${i + 1}/${people.length} ${people[i][0]}\n`
    );
  }
} else {
  throw new Error(
    `El lote ${BATCH} está incompleto: existen ${previousSeedUsers.length} de ${people.length} usuarios.`
  );
}

/* =========================================================
   PERFILES
   ========================================================= */

console.log('Creando perfiles...');

const profiles = users.map(
  (user, index) =>
    makeProfile(user, people[index], index)
);

await insertRows(
  'profiles',
  profiles,
  true
);

/* =========================================================
   ONBOARDING
   ========================================================= */

console.log('Creando preferencias de onboarding...');

const preferences = users.map(
  (user, index) =>
    makePreferences(
      user,
      profiles[index],
      index
    )
);

await insertRows(
  'onboarding_preferences',
  preferences,
  true
);

/* =========================================================
   LISTINGS
   ========================================================= */

console.log('Creando viviendas...');

const listings = makeListings(users);

await insertRows(
  'listings',
  listings
);

/* =========================================================
   COMUNIDADES
   ========================================================= */

console.log('Creando comunidades...');

const communities =
  makeCommunities(users);

await insertRows(
  'communities',
  communities
);

/* =========================================================
   MIEMBROS DE COMUNIDADES
   ========================================================= */

console.log('Añadiendo miembros a comunidades...');

const memberships = [];

for (let i = 0; i < communities.length; i++) {
  const community = communities[i];

  const ownerIndex =
    i % users.length;

  memberships.push({
    community_id: community.id,
    user_id: users[ownerIndex].id,
    role: 'owner',
    status: 'active',
    joined_at: isoDaysAgo(45 - i)
  });

  for (let offset = 1; offset <= 7; offset++) {
    const user =
      users[(ownerIndex + offset) % users.length];

    memberships.push({
      community_id: community.id,
      user_id: user.id,
      role: 'member',
      status: 'active',
      joined_at: isoDaysAgo(
        Math.max(1, 35 - i - offset)
      )
    });
  }
}

await insertRows(
  'community_members',
  memberships,
  true
);

/* =========================================================
   POSTS
   ========================================================= */

console.log('Creando publicaciones...');

const posts =
  makePosts(
    users,
    communities,
    listings
  );

await insertRows(
  'posts',
  posts
);

/* =========================================================
   MANIFEST LOCAL
   ========================================================= */

const manifest = {
  batch: BATCH,
  generated_at: new Date().toISOString(),
  users: users.map((user, index) => ({
    id: user.id,
    email: user.email,
    alias: people[index][0]
  })),
  listings: listings.map(x => x.id),
  communities: communities.map(x => x.id),
  posts: posts.map(x => x.id)
};

fs.writeFileSync(
  'scripts/.alpha-seed-manifest.json',
  JSON.stringify(manifest, null, 2)
);

/* =========================================================
   RESULTADO
   ========================================================= */

console.log('');
console.log('======================================');
console.log('SEED ALPHA COMPLETADO');
console.log('======================================');
console.log(`Usuarios:       ${users.length}`);
console.log(`Perfiles:       ${profiles.length}`);
console.log(`Preferencias:   ${preferences.length}`);
console.log(`Viviendas:      ${listings.length}`);
console.log(`Comunidades:    ${communities.length}`);
console.log(`Miembros:       ${memberships.length}`);
console.log(`Posts:          ${posts.length}`);
console.log('');
console.log(
  'Manifest: scripts/.alpha-seed-manifest.json'
);
console.log('');
