// ========== CONFIGURACIÓN DE SUPABASE ==========
const supabaseUrl = SUPABASE_URL;  // From /js/supabase-config.js
const supabaseKey = SUPABASE_ANON_KEY;  // From /js/supabase-config.js
var sb = null;
try { sb = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : window.supabase?.createClient(supabaseUrl, supabaseKey); }
catch(e) { console.warn('[neuro-chef] Supabase init failed:', e.message); }

// ========== DATOS DE ALIMENTOS ==========
const ALIMENTOS = {
    // CARNES Y PROTEÍNAS
    carne_picada: {
        id: 'carne_picada',
        nombre: 'Carne Picada',
        emoji: '🥩',
        categoria: 'proteina_animal',
        estado: 'crudo',
        zona_heladera: 'fria',
        posicion: 'abajo',
        temperatura: 2,
        duracion_dias: 2,
        riesgo_contaminacion: 'alto',
        tags: ['carne', 'picada', 'roja', 'cruda', 'proteína']
    },
    bife: {
        id: 'bife',
        nombre: 'Bife',
        emoji: '🥩',
        categoria: 'proteina_animal',
        estado: 'crudo',
        zona_heladera: 'fria',
        posicion: 'abajo',
        temperatura: 2,
        duracion_dias: 3,
        riesgo_contaminacion: 'alto'
    },
    pollo: {
        id: 'pollo',
        nombre: 'Pollo',
        emoji: '🍗',
        categoria: 'proteina_animal',
        estado: 'crudo',
        zona_heladera: 'fria',
        posicion: 'abajo',
        temperatura: 2,
        duracion_dias: 2,
        riesgo_contaminacion: 'muy_alto'
    },
    pescado: {
        id: 'pescado',
        nombre: 'Pescado',
        emoji: '🐟',
        categoria: 'proteina_animal',
        estado: 'crudo',
        zona_heladera: 'fria',
        posicion: 'abajo',
        temperatura: 0,
        duracion_dias: 1,
        riesgo_contaminacion: 'muy_alto'
    },
    salchichas: {
        id: 'salchichas',
        nombre: 'Salchichas',
        emoji: '🌭',
        categoria: 'proteina_procesada',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 7
    },
    jamon: {
        id: 'jamon',
        nombre: 'Jamón Cocido',
        emoji: '🍖',
        categoria: 'proteina_procesada',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 7
    },
    huevos: {
        id: 'huevos',
        nombre: 'Huevos',
        emoji: '🥚',
        categoria: 'proteina_animal',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 21
    },
    
    // LÁCTEOS
    leche: {
        id: 'leche',
        nombre: 'Leche',
        emoji: '🥛',
        categoria: 'lacteo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 7
    },
    yogur: {
        id: 'yogur',
        nombre: 'Yogur',
        emoji: '🥛',
        categoria: 'lacteo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 14
    },
    manteca: {
        id: 'manteca',
        nombre: 'Manteca',
        emoji: '🧈',
        categoria: 'lacteo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 30
    },
    queso: {
        id: 'queso',
        nombre: 'Queso',
        emoji: '🧀',
        categoria: 'lacteo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 14
    },
    queso_rallado: {
        id: 'queso_rallado',
        nombre: 'Queso Rallado',
        emoji: '🧀',
        categoria: 'lacteo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 21
    },
    crema: {
        id: 'crema',
        nombre: 'Crema de Leche',
        emoji: '🥛',
        categoria: 'lacteo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 14
    },
    
    // VERDURAS
    lechuga: {
        id: 'lechuga',
        nombre: 'Lechuga',
        emoji: '🥬',
        categoria: 'verdura',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 5
    },
    tomate: {
        id: 'tomate',
        nombre: 'Tomate',
        emoji: '🍅',
        categoria: 'verdura',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 7
    },
    cebolla: {
        id: 'cebolla',
        nombre: 'Cebolla',
        emoji: '🧅',
        categoria: 'verdura',
        zona_heladera: 'afuera',
        temperatura: 18,
        duracion_dias: 30
    },
    zanahoria: {
        id: 'zanahoria',
        nombre: 'Zanahoria',
        emoji: '🥕',
        categoria: 'verdura',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 14
    },
    pepino: {
        id: 'pepino',
        nombre: 'Pepino',
        emoji: '🥒',
        categoria: 'verdura',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 7
    },
    morron: {
        id: 'morron',
        nombre: 'Morrón',
        emoji: '🫑',
        categoria: 'verdura',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 10
    },
    brocoli: {
        id: 'brocoli',
        nombre: 'Brócoli',
        emoji: '🥦',
        categoria: 'verdura',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 7
    },
    papa: {
        id: 'papa',
        nombre: 'Papas',
        emoji: '🥔',
        categoria: 'verdura',
        zona_heladera: 'afuera',
        temperatura: 15,
        duracion_dias: 30
    },
    ajo: {
        id: 'ajo',
        nombre: 'Ajo',
        emoji: '🧄',
        categoria: 'condimento',
        zona_heladera: 'afuera',
        temperatura: 18,
        duracion_dias: 60
    },
    
    // ADEREZOS Y CONDIMENTOS
    mayonesa: {
        id: 'mayonesa',
        nombre: 'Mayonesa',
        emoji: '🍶',
        categoria: 'aderezo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 60
    },
    mostaza: {
        id: 'mostaza',
        nombre: 'Mostaza',
        emoji: '🍯',
        categoria: 'aderezo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 90
    },
    ketchup: {
        id: 'ketchup',
        nombre: 'Ketchup',
        emoji: '🥫',
        categoria: 'aderezo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 90
    },
    aceitunas: {
        id: 'aceitunas',
        nombre: 'Aceitunas',
        emoji: '🫒',
        categoria: 'aderezo',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 180
    },
    
    // FREEZER
    hielo: {
        id: 'hielo',
        nombre: 'Hielo',
        emoji: '🧊',
        categoria: 'freezer',
        zona_heladera: 'freezer',
        temperatura: -18,
        duracion_dias: 365
    },
    helado: {
        id: 'helado',
        nombre: 'Helado',
        emoji: '🍦',
        categoria: 'freezer',
        zona_heladera: 'freezer',
        temperatura: -18,
        duracion_dias: 180
    },
    vegetales_congelados: {
        id: 'vegetales_congelados',
        nombre: 'Vegetales Congelados',
        emoji: '🥦',
        categoria: 'freezer',
        zona_heladera: 'freezer',
        temperatura: -18,
        duracion_dias: 365
    },
    
    // BEBIDAS
    jugo: {
        id: 'jugo',
        nombre: 'Jugo',
        emoji: '🧃',
        categoria: 'bebida',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 7
    },
    gaseosa: {
        id: 'gaseosa',
        nombre: 'Gaseosa',
        emoji: '🥤',
        categoria: 'bebida',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 90
    },
    
    // NO VA EN HELADERA
    pan: {
        id: 'pan',
        nombre: 'Pan',
        emoji: '🍞',
        categoria: 'panificado',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 3
    },
    pan_rallado: {
        id: 'pan_rallado',
        nombre: 'Pan Rallado',
        emoji: '🍞',
        categoria: 'cereal',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 180
    },
    sal: {
        id: 'sal',
        nombre: 'Sal',
        emoji: '🧂',
        categoria: 'condimento',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 3650
    },
    azucar: {
        id: 'azucar',
        nombre: 'Azúcar',
        emoji: '🍬',
        categoria: 'condimento',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 3650
    },
    aceite: {
        id: 'aceite',
        nombre: 'Aceite',
        emoji: '🛢️',
        categoria: 'condimento',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 365
    },

    // EXTRAS para recetas
    arroz: {
        id: 'arroz',
        nombre: 'Arroz',
        emoji: '🍚',
        categoria: 'cereal',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 365
    },
    harina: {
        id: 'harina',
        nombre: 'Harina',
        emoji: '🌾',
        categoria: 'cereal',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 180
    },
    pasas_uva: {
        id: 'pasas_uva',
        nombre: 'Pasas de Uva',
        emoji: '🍇',
        categoria: 'fruto_seco',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 180
    },
    canela: {
        id: 'canela',
        nombre: 'Canela',
        emoji: '🌰',
        categoria: 'condimento',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 365
    },
    frutas_secas: {
        id: 'frutas_secas',
        nombre: 'Frutas Secas',
        emoji: '🥜',
        categoria: 'fruto_seco',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 180
    },
    vinagre: {
        id: 'vinagre',
        nombre: 'Vinagre',
        emoji: '🧴',
        categoria: 'aderezo',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 365
    },
    limon: {
        id: 'limon',
        nombre: 'Limón',
        emoji: '🍋',
        categoria: 'fruta',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 14
    },
    perejil: {
        id: 'perejil',
        nombre: 'Perejil',
        emoji: '🌿',
        categoria: 'verdura',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 7
    },
    nuez_moscada: {
        id: 'nuez_moscada',
        nombre: 'Nuez Moscada',
        emoji: '🌰',
        categoria: 'condimento',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 365
    },
    ciruelas_pasas: {
        id: 'ciruelas_pasas',
        nombre: 'Ciruelas Pasas',
        emoji: '🫐',
        categoria: 'fruto_seco',
        zona_heladera: 'afuera',
        temperatura: 20,
        duracion_dias: 180
    },

    // FRUTAS para licuados
    banana: {
        id: 'banana',
        nombre: 'Banana',
        emoji: '🍌',
        categoria: 'fruta',
        zona_heladera: 'afuera',
        temperatura: 18,
        duracion_dias: 5
    },
    frutilla: {
        id: 'frutilla',
        nombre: 'Frutilla',
        emoji: '🍓',
        categoria: 'fruta',
        zona_heladera: 'verduras',
        temperatura: 4,
        duracion_dias: 5
    },
    mango: {
        id: 'mango',
        nombre: 'Mango',
        emoji: '🥭',
        categoria: 'fruta',
        zona_heladera: 'verduras',
        temperatura: 6,
        duracion_dias: 7
    },
    jugo_naranja: {
        id: 'jugo_naranja',
        nombre: 'Jugo de Naranja',
        emoji: '🍊',
        categoria: 'bebida',
        zona_heladera: 'fria',
        temperatura: 4,
        duracion_dias: 7
    }
};

// ========== RECETAS ==========
const RECETAS = {
    pastel_papas: {
        id: 'pastel_papas',
        nombre: 'Pastel de Papas',
        ingredientes_base: ['papa', 'carne_picada', 'cebolla', 'huevos', 'aceite', 'sal'],
        ingredientes_opcionales: ['aceitunas', 'pasas_uva', 'leche', 'manteca', 'canela', 'azucar', 'queso', 'ciruelas_pasas'],
        distractores: ['pescado', 'lechuga', 'arroz', 'banana', 'helado'],
        pasos: [
            'Hervir las papas con piel en agua con sal',
            'Hacer un sofrito de cebolla hasta transparentar',
            'Agregar la carne picada y cocinar hasta dorar',
            'Pelar las papas y hacer un puré con leche y manteca',
            'En una fuente, poner la carne abajo y el puré arriba',
            'Pintar con huevo batido',
            'Gratinar en el horno a 200°C por 15 minutos'
        ],
        tips_receta: {
            consejo_clave: 'Las papas se hierven CON piel para que no absorban agua. El puré queda más seco y firme.',
            error_comun: 'Si el puré queda aguado, el pastel no se sostiene. Escurrí bien las papas.',
            logica: 'Las aceitunas, pasas de uva y ciruelas pasas son extras clásicos del pastel. La canela, el azúcar y el queso son opcionales según la receta familiar.'
        }
    },
    lasagna: {
        id: 'lasagna',
        nombre: 'Lasaña',
        ingredientes_base: ['carne_picada', 'cebolla', 'tomate', 'queso', 'leche', 'sal'],
        ingredientes_opcionales: ['aceite', 'queso_rallado', 'manteca', 'harina'],
        distractores: ['pescado', 'lechuga', 'arroz', 'azucar', 'banana'],
        pasos: [
            'Hacer la salsa bolognesa con carne, cebolla y tomate',
            'Preparar la salsa blanca con leche, manteca y harina',
            'Hervir las láminas de lasaña en agua con sal',
            'En una fuente, alternar capas: salsa, pasta, queso',
            'Terminar con salsa blanca y queso rallado',
            'Hornear a 180°C por 30 minutos hasta gratinar'
        ],
        tips_receta: {
            consejo_clave: 'La salsa blanca se hace con leche, manteca y harina. Si se forman grumos, batir enérgicamente.',
            error_comun: 'Las capas deben alternarse: bolognesa, pasta, blanca, queso. Si ponés todo junto, no se arma.',
            logica: 'El queso rallado es extra para gratinar. El arroz y la banana NO tienen nada que ver con la lasaña.'
        }
    },
    budin_ingles: {
        id: 'budin_ingles',
        nombre: 'Budín Inglés',
        ingredientes_base: ['huevos', 'azucar', 'manteca', 'leche', 'harina'],
        ingredientes_opcionales: ['sal', 'pasas_uva', 'frutas_secas', 'canela'],
        distractores: ['carne_picada', 'lechuga', 'papa', 'pollo', 'tomate'],
        pasos: [
            'Batir la manteca pomada con el azúcar hasta cremar',
            'Agregar los huevos de a uno, batiendo bien',
            'Incorporar la harina tamizada alternando con la leche',
            'Agregar frutas secas y pasas enharinadas',
            'Volcar en molde de budín enmantecado y enharinado',
            'Hornear a 170°C por 45 minutos'
        ],
        tips_receta: {
            consejo_clave: 'Las pasas y frutas secas se enharinan ANTES de mezclarlas para que no se hundan al fondo.',
            error_comun: 'Si la manteca no está a temperatura ambiente, no crema bien con el azúcar.',
            logica: 'Pasas de uva, frutas secas y canela son extras clásicos de budín. La carne y el pollo son ingredientes salados que NO van.'
        }
    },
    ensalada_completa: {
        id: 'ensalada_completa',
        nombre: 'Ensalada Completa',
        ingredientes_base: ['lechuga', 'tomate', 'cebolla', 'huevos', 'aceite', 'sal'],
        ingredientes_opcionales: ['aceitunas', 'zanahoria', 'vinagre', 'limon'],
        distractores: ['carne_picada', 'azucar', 'arroz', 'canela', 'helado'],
        pasos: [
            'Lavar bien la lechuga hoja por hoja',
            'Hervir los huevos durante 10 minutos',
            'Pelar y rallar la zanahoria',
            'Cortar el tomate en gajos',
            'Cortar la cebolla en aros finos',
            'Mezclar todo en un bol grande y condimentar'
        ],
        tips_receta: {
            consejo_clave: 'Lavar CADA hoja de lechuga individualmente elimina tierra y posibles insectos.',
            error_comun: 'Si cortás la lechuga con cuchillo de metal, se oxida más rápido. Mejor trozar con las manos.',
            logica: 'El aceite, vinagre y limón son aderezos clásicos de ensalada. El azúcar y la canela son para postres, NO van acá.'
        }
    },
    milanesas: {
        id: 'milanesas',
        nombre: 'Milanesas',
        ingredientes_base: ['bife', 'huevos', 'pan_rallado', 'aceite', 'sal'],
        ingredientes_opcionales: ['ajo', 'limon', 'perejil', 'nuez_moscada', 'leche'],
        distractores: ['azucar', 'arroz', 'banana', 'helado', 'pescado'],
        pasos: [
            'Golpear los bifes con un martillo hasta aplanar',
            'Salar los bifes por ambos lados',
            'Batir los huevos en un plato hondo',
            'Pasar cada bife por huevo',
            'Pasar por pan rallado presionando bien',
            'Freír en aceite caliente o cocinar al horno'
        ],
        tips_receta: {
            consejo_clave: 'Aplanar el bife asegura cocción pareja. El pan rallado debe presionarse bien para que no se despegue.',
            error_comun: 'Si el aceite no está bien caliente, la milanesa absorbe grasa y queda pesada.',
            logica: 'El ajo y perejil saborizan el huevo batido. La leche y nuez moscada tiernizan la carne al remojarla. El azúcar NO va en milanesas.'
        }
    }
};

// ========== COLORES POST-GAME (12 proyectivos) ==========
// Usa el shared system de /games/shared/mood-modals.js
// Solo referencia para fallback
const COLORES_PROYECTIVOS = [
    '#FF0000', '#FF8C00', '#FFD700', '#008000',
    '#00CED1', '#87CEEB', '#00008B', '#800080',
    '#FF69B4', '#8B4513', '#808080', '#000000'
];

// ========== LICUADORA: COMBINACIONES ==========
const LICUADOS = {
    banana_frutilla: {
        nombre: 'Licuado de Banana y Frutilla',
        secuencia_correcta: ['leche', 'banana', 'frutilla', 'hielo'],
        explicacion: 'Primero el líquido para que las cuchillas no se traben, luego las frutas blandas y al final el hielo.'
    },
    tropical: {
        nombre: 'Smoothie Tropical',
        secuencia_correcta: ['jugo_naranja', 'banana', 'mango', 'hielo'],
        explicacion: 'El líquido siempre primero. Las frutas más blandas antes. El hielo siempre al final para no dañar cuchillas.'
    }
};

// ========== MESA: ELEMENTOS ==========
const ELEMENTOS_MESA = {
    mantel: { id: 'mantel', nombre: 'Mantel', emoji: '', zona: 'base', orden: 1 },
    plato_base: { id: 'plato_base', nombre: 'Plato grande', emoji: '️', zona: 'centro', orden: 2 },
    plato_hondo: { id: 'plato_hondo', nombre: 'Plato hondo', emoji: '', zona: 'centro', orden: 3 },
    tenedor: { id: 'tenedor', nombre: 'Tenedor', emoji: '', zona: 'izquierda', orden: 4 },
    cuchillo: { id: 'cuchillo', nombre: 'Cuchillo', emoji: '', zona: 'derecha', orden: 5 },
    cuchara: { id: 'cuchara', nombre: 'Cuchara', emoji: '', zona: 'derecha', orden: 6 },
    vaso: { id: 'vaso', nombre: 'Vaso', emoji: '', zona: 'derecha_arriba', orden: 7 },
    servilleta: { id: 'servilleta', nombre: 'Servilleta', emoji: '', zona: 'izquierda', orden: 8 },
    // Distractores
    sarten: { id: 'sarten', nombre: 'Sartén', emoji: '', zona: 'NO_VA', orden: 0 },
    olla: { id: 'olla', nombre: 'Olla', emoji: '', zona: 'NO_VA', orden: 0 },
    esponja: { id: 'esponja', nombre: 'Esponja', emoji: '', zona: 'NO_VA', orden: 0 },
    tabla: { id: 'tabla', nombre: 'Tabla de picar', emoji: '', zona: 'NO_VA', orden: 0 }
};

// ========== HABITACIÓN: ROPA ==========
// ============================================================
// SVG Icons para el Nivel 6 - Habitacion (V5.2, audit #164 offshoot)
// Gonzalo: 'esto tiene q ser grafico'. Line-art icons dibujados
// a mano, sin dependencias, sin emojis. Estilo minimalista.
// ============================================================
const ROPA_SVG = {
    camisa:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4l-4 3v3l3-1v11h10V9l3 1V7l-4-3-2 2h-4z"/></svg>',
    pantalon:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10l-1 18h-3l-1-10-1 10H8z"/><path d="M7 3h10"/></svg>',
    campera:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4l-4 3v3l3-1v11h10V9l3 1V7l-4-3"/><path d="M12 4v18"/><path d="M10 4h4"/></svg>',
    vestido:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l1 4-1 2 3 12H6l3-12-1-2z"/></svg>',
    remera:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5l-3 3v2l2-1v10h10V9l2 1V8l-3-3h-3a2 2 0 01-4 0z"/></svg>',
    medias:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3h5v12l-2 5h-5l5-5V3"/></svg>',
    ropa_interior:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16l-2 6-4-3h-4l-4 3z"/></svg>',
    pijama:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3l-2 2v2l2-1v4h10V6l2 1V5l-2-2h-3l-1 1h-2l-1-1z"/><path d="M7 13h10l-1 8h-3l-1-5-1 5H8z"/></svg>',
    zapatos:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c0-1 1-2 2-2l5-5 4 1 5 4c2 1 2 3 2 4H3z"/><path d="M3 17h18"/></svg>',
    zapatillas:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c0-1 1-2 2-2l5-5 3 2 3 1 4 3c2 1 2 3 2 4H3z"/><path d="M8 11l2 2M10 9l2 2M12 10l2 2"/></svg>',
    ojotas:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="17" rx="8" ry="3"/><path d="M12 14V7l-3-2M12 7l3-2"/></svg>',
    botas:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h4v10l5 3c2 1 2 3 2 4H7c-1 0-2-1-2-2V7z"/><path d="M7 19h14"/></svg>',
    paraguas:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 0120 0z"/><path d="M12 2v10M12 12v7a2 2 0 002 2"/></svg>',
    toalla:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 8h16M4 12h16M4 16h16"/></svg>'
};

// SVG icons para los MUEBLES (destinos de drop)
const MUEBLE_SVG = {
    placard:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M12 3v18M8 12h0.01M16 12h0.01"/></svg>',
    cajon:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 12h18M10 9h4M10 16h4"/></svg>',
    zapatera:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M3 19h18"/></svg>',
    NO_VA:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>'
};

const ROPA = {
    camisa:       { id: 'camisa',       nombre: 'Camisa',        destino: 'placard',  svg: ROPA_SVG.camisa },
    pantalon:     { id: 'pantalon',     nombre: 'Pantalón',      destino: 'placard',  svg: ROPA_SVG.pantalon },
    campera:      { id: 'campera',      nombre: 'Campera',       destino: 'placard',  svg: ROPA_SVG.campera },
    vestido:      { id: 'vestido',      nombre: 'Vestido',       destino: 'placard',  svg: ROPA_SVG.vestido },
    remera:       { id: 'remera',       nombre: 'Remera',        destino: 'cajon',    svg: ROPA_SVG.remera },
    medias:       { id: 'medias',       nombre: 'Medias',        destino: 'cajon',    svg: ROPA_SVG.medias },
    ropa_interior:{ id: 'ropa_interior',nombre: 'Ropa interior', destino: 'cajon',    svg: ROPA_SVG.ropa_interior },
    pijama:       { id: 'pijama',       nombre: 'Pijama',        destino: 'cajon',    svg: ROPA_SVG.pijama },
    zapatos:      { id: 'zapatos',      nombre: 'Zapatos',       destino: 'zapatera', svg: ROPA_SVG.zapatos },
    zapatillas:   { id: 'zapatillas',   nombre: 'Zapatillas',    destino: 'zapatera', svg: ROPA_SVG.zapatillas },
    ojotas:       { id: 'ojotas',       nombre: 'Ojotas',        destino: 'zapatera', svg: ROPA_SVG.ojotas },
    botas:        { id: 'botas',        nombre: 'Botas',         destino: 'zapatera', svg: ROPA_SVG.botas },
    // Distractores - NO va en ninguno
    paraguas:     { id: 'paraguas',     nombre: 'Paraguas',      destino: 'NO_VA',    svg: ROPA_SVG.paraguas },
    toalla:       { id: 'toalla',       nombre: 'Toalla',        destino: 'NO_VA',    svg: ROPA_SVG.toalla }
};

// ========== ESTADO DEL JUEGO ==========
const gameState = {
    patientId: null,
    patientDni: null,
    sessionId: null,
    currentLevel: 1,
    totalLevels: 6,
    startTime: null,
    
    // Métricas globales
    totalCorrect: 0,
    totalErrors: 0,
    
    // Métricas por nivel
    levelMetrics: [],
    
    // Modal pre-game
    preMood: {
        q1: '',
        q2: '',
        q3: ''
    },
    
    // Modal post-game
    postMood: {
        intensity: '',
        color: ''
    },
    
    // Biometric data per level (array)
    biometricData: [],
    
    // Player session history (loaded from Supabase)
    playerHistory: [],
    
    // Game registry
    gameId: null
};
