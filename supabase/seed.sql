-- ============================================================================
-- Seed — datos realistas en COP para el workspace del Build Day.
--
-- ¿Por qué existe esto? Porque el log de transacciones lo construye UNA persona,
-- y las otras tres (Dashboard, Gmail, Chat) quedarían bloqueadas esperándola.
-- Con este seed, todos tienen data real contra la cual construir desde el minuto 0.
--
-- Correr:  npm run db:seed
-- ============================================================================

do $$
declare
  ws uuid := '00000000-0000-0000-0000-000000000001';
begin

insert into workspaces (id, name) values (ws, 'Build Day Medellín')
on conflict (id) do nothing;

-- --------------------------------- Categorías -------------------------------
insert into categories (workspace_id, name, kind, icon, color) values
  (ws, 'Salario',        'income',  'wallet',       '#22c55e'),
  (ws, 'Freelance',      'income',  'laptop',       '#10b981'),
  (ws, 'Ventas',         'income',  'trending-up',  '#14b8a6'),
  (ws, 'Rendimientos',   'income',  'piggy-bank',   '#06b6d4'),
  (ws, 'Arriendo',       'expense', 'home',         '#ef4444'),
  (ws, 'Mercado',        'expense', 'shopping-cart','#f97316'),
  (ws, 'Restaurantes',   'expense', 'utensils',     '#f59e0b'),
  (ws, 'Transporte',     'expense', 'car',          '#eab308'),
  (ws, 'Servicios',      'expense', 'zap',          '#8b5cf6'),
  (ws, 'Salud',          'expense', 'heart-pulse',  '#ec4899'),
  (ws, 'Entretenimiento','expense', 'clapperboard', '#a855f7'),
  (ws, 'Educación',      'expense', 'graduation-cap','#3b82f6'),
  (ws, 'Ropa',           'expense', 'shirt',        '#6366f1'),
  (ws, 'Otros',          'expense', 'circle-dashed','#64748b')
on conflict (workspace_id, name, kind) do nothing;

end $$;

-- ------------------------------- Transacciones -------------------------------
-- Mezcla deliberada de los 3 orígenes para que el Dashboard los pueda distinguir:
--   source='gmail'  → lo que la persona de Bancolombia va a generar automáticamente
--   source='cash'   → lo que la persona de efectivo va a capturar a mano
--   source='manual' → carga manual normal
with ws as (select '00000000-0000-0000-0000-000000000001'::uuid id),
cat as (select c.name, c.id from categories c, ws where c.workspace_id = ws.id)
insert into transactions
  (workspace_id, kind, amount_cents, description, category_id, occurred_at, source, source_ref, merchant)
select ws.id, v.kind::transaction_kind, v.amount, v.descr,
       (select id from cat where cat.name = v.cat),
       now() - (v.days_ago || ' days')::interval,
       v.src::transaction_source,
       case when v.src = 'gmail' then 'seed-msg-' || v.rn else null end,
       v.merchant
from ws, (values
  -- INGRESOS
  (1,  'income',  450000000::bigint, 'Salario quincena',            'Salario',        2,  'gmail',  'Bancolombia'),
  (2,  'income',  450000000::bigint, 'Salario quincena',            'Salario',        17, 'gmail',  'Bancolombia'),
  (3,  'income',  450000000::bigint, 'Salario quincena',            'Salario',        32, 'gmail',  'Bancolombia'),
  (4,  'income',  450000000::bigint, 'Salario quincena',            'Salario',        47, 'gmail',  'Bancolombia'),
  (5,  'income',  180000000::bigint, 'Proyecto landing page',       'Freelance',      9,  'manual', 'Cliente Bogotá'),
  (6,  'income',  240000000::bigint, 'Consultoría automatización',  'Freelance',      25, 'manual', 'Cliente Medellín'),
  (7,  'income',   95000000::bigint, 'Venta equipo usado',          'Ventas',         38, 'manual', 'Mercado Libre'),
  (8,  'income',   12400000::bigint, 'Rendimientos cuenta ahorro',  'Rendimientos',   30, 'gmail',  'Bancolombia'),
  (9,  'income',   11800000::bigint, 'Rendimientos cuenta ahorro',  'Rendimientos',   60, 'gmail',  'Bancolombia'),
  -- ARRIENDO Y SERVICIOS
  (10, 'expense', 180000000::bigint, 'Arriendo apartamento',        'Arriendo',       3,  'gmail',  'Inmobiliaria'),
  (11, 'expense', 180000000::bigint, 'Arriendo apartamento',        'Arriendo',       33, 'gmail',  'Inmobiliaria'),
  (12, 'expense', 180000000::bigint, 'Arriendo apartamento',        'Arriendo',       63, 'gmail',  'Inmobiliaria'),
  (13, 'expense',  21500000::bigint, 'Energía y gas',               'Servicios',      5,  'gmail',  'EPM'),
  (14, 'expense',  19800000::bigint, 'Energía y gas',               'Servicios',      35, 'gmail',  'EPM'),
  (15, 'expense',   8900000::bigint, 'Internet hogar',              'Servicios',      6,  'gmail',  'Claro'),
  (16, 'expense',   8900000::bigint, 'Internet hogar',              'Servicios',      36, 'gmail',  'Claro'),
  (17, 'expense',   5500000::bigint, 'Plan celular',                'Servicios',      6,  'gmail',  'Tigo'),
  (18, 'expense',   4200000::bigint, 'Acueducto',                   'Servicios',      12, 'gmail',  'EPM'),
  -- MERCADO
  (19, 'expense',  28500000::bigint, 'Mercado semanal',             'Mercado',        1,  'gmail',  'Éxito'),
  (20, 'expense',  15200000::bigint, 'Mercado rápido',              'Mercado',        4,  'gmail',  'D1'),
  (21, 'expense',  31800000::bigint, 'Mercado semanal',             'Mercado',        8,  'gmail',  'Carulla'),
  (22, 'expense',  12400000::bigint, 'Frutas y verduras',           'Mercado',        10, 'cash',   'Plaza Minorista'),
  (23, 'expense',  26900000::bigint, 'Mercado semanal',             'Mercado',        15, 'gmail',  'Éxito'),
  (24, 'expense',   9800000::bigint, 'Mercado rápido',              'Mercado',        18, 'gmail',  'Ara'),
  (25, 'expense',  33400000::bigint, 'Mercado semanal',             'Mercado',        22, 'gmail',  'Carulla'),
  (26, 'expense',  14100000::bigint, 'Frutas y verduras',           'Mercado',        24, 'cash',   'Plaza Minorista'),
  (27, 'expense',  27600000::bigint, 'Mercado semanal',             'Mercado',        29, 'gmail',  'Éxito'),
  -- RESTAURANTES
  (28, 'expense',   4800000::bigint, 'Almuerzo',                    'Restaurantes',   1,  'cash',   'Corrientazo'),
  (29, 'expense',   8900000::bigint, 'Café con cliente',            'Restaurantes',   2,  'gmail',  'Juan Valdez'),
  (30, 'expense',  15600000::bigint, 'Cena',                        'Restaurantes',   5,  'gmail',  'Crepes & Waffles'),
  (31, 'expense',   3500000::bigint, 'Almuerzo',                    'Restaurantes',   7,  'cash',   'Corrientazo'),
  (32, 'expense',  22400000::bigint, 'Cena con amigos',             'Restaurantes',   11, 'gmail',  'Rappi'),
  (33, 'expense',   4200000::bigint, 'Almuerzo',                    'Restaurantes',   14, 'cash',   'Corrientazo'),
  (34, 'expense',   6700000::bigint, 'Desayuno',                    'Restaurantes',   16, 'cash',   'Panadería'),
  (35, 'expense',  18900000::bigint, 'Domicilio',                   'Restaurantes',   19, 'gmail',  'Rappi'),
  (36, 'expense',   3800000::bigint, 'Almuerzo',                    'Restaurantes',   21, 'cash',   'Corrientazo'),
  (37, 'expense',  12300000::bigint, 'Cena',                        'Restaurantes',   26, 'gmail',  'Rappi'),
  -- TRANSPORTE
  (38, 'expense',   2900000::bigint, 'Metro',                       'Transporte',     1,  'cash',   'Metro de Medellín'),
  (39, 'expense',  14500000::bigint, 'Uber al aeropuerto',          'Transporte',     3,  'gmail',  'Uber'),
  (40, 'expense',   2900000::bigint, 'Metro',                       'Transporte',     4,  'cash',   'Metro de Medellín'),
  (41, 'expense',   8200000::bigint, 'Taxi',                        'Transporte',     9,  'cash',   'Taxi'),
  (42, 'expense',  16800000::bigint, 'Gasolina',                    'Transporte',     13, 'gmail',  'Terpel'),
  (43, 'expense',   2900000::bigint, 'Metro',                       'Transporte',     16, 'cash',   'Metro de Medellín'),
  (44, 'expense',   6400000::bigint, 'Cabify',                      'Transporte',     20, 'gmail',  'Cabify'),
  (45, 'expense',  17200000::bigint, 'Gasolina',                    'Transporte',     28, 'gmail',  'Terpel'),
  -- ENTRETENIMIENTO / SUSCRIPCIONES
  (46, 'expense',   3890000::bigint, 'Suscripción música',          'Entretenimiento',2,  'gmail',  'Spotify'),
  (47, 'expense',   4490000::bigint, 'Suscripción streaming',       'Entretenimiento',3,  'gmail',  'Netflix'),
  (48, 'expense',  11200000::bigint, 'Cine',                        'Entretenimiento',12, 'cash',   'Cine Colombia'),
  (49, 'expense',   3890000::bigint, 'Suscripción música',          'Entretenimiento',32, 'gmail',  'Spotify'),
  (50, 'expense',   4490000::bigint, 'Suscripción streaming',       'Entretenimiento',33, 'gmail',  'Netflix'),
  (51, 'expense',  28000000::bigint, 'Concierto',                   'Entretenimiento',40, 'gmail',  'Tuboleta'),
  -- SALUD
  (52, 'expense',  32000000::bigint, 'Consulta médica',             'Salud',          14, 'gmail',  'Clínica'),
  (53, 'expense',   8700000::bigint, 'Farmacia',                    'Salud',          15, 'gmail',  'Cruz Verde'),
  (54, 'expense',  15000000::bigint, 'Gimnasio',                    'Salud',          7,  'gmail',  'Smart Fit'),
  (55, 'expense',  15000000::bigint, 'Gimnasio',                    'Salud',          37, 'gmail',  'Smart Fit'),
  -- EDUCACIÓN / ROPA / OTROS
  (56, 'expense',  45000000::bigint, 'Curso online',                'Educación',      20, 'gmail',  'Platzi'),
  (57, 'expense',  89000000::bigint, 'Ropa',                        'Ropa',           23, 'gmail',  'Falabella'),
  (58, 'expense',  12500000::bigint, 'Peluquería',                  'Otros',          11, 'cash',   'Barbería'),
  (59, 'expense',   6800000::bigint, 'Papelería',                   'Otros',          27, 'cash',   'Panamericana'),
  (60, 'expense',  24000000::bigint, 'Regalo cumpleaños',           'Otros',          31, 'cash',   'Varios')
) as v(rn, kind, amount, descr, cat, days_ago, src, merchant);
