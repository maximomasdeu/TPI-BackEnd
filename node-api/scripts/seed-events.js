import { pool } from '../src/config/db.js'

// Imagen compartida por los eventos de ejemplo cargados en desarrollo.
const image = 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=80'

// Datos iniciales; el slug identifica cada evento y evita duplicarlo al ejecutar otra vez.
const events = [
  ['feria-artesanal-costanera', 'Feria artesanal de la costanera', 'Cultura', 'Artesanos y emprendedores de Goya se reúnen junto al río con piezas únicas, demostraciones en vivo y propuestas para toda la familia.', '2026-12-05T17:00:00-03:00', '2026-12-05T22:00:00-03:00', 'Paseo Costero', 'Goya, Corrientes', 'Colectivo de Artesanos de Goya', 'published'],
  ['festival-del-chamame-goyano', 'Festival del chamamé goyano', 'Música', 'Una noche de música litoraleña con conjuntos locales, baile y un patio gastronómico dedicado a los sabores correntinos.', '2026-12-12T20:00:00-03:00', '2026-12-13T01:00:00-03:00', 'Anfiteatro Municipal', 'Goya, Corrientes', 'Cultura Goya', 'published'],
  ['caminata-salud-rio-parana', 'Caminata Salud junto al Paraná', 'Deportes', 'Recorrido recreativo de cinco kilómetros por la ribera, con puestos de hidratación y actividades para todas las edades.', '2026-12-13T08:30:00-03:00', '2026-12-13T11:30:00-03:00', 'Plaza Italia', 'Goya, Corrientes', 'Secretaría de Deportes', 'published'],
  ['mercado-sabores-del-litoral', 'Mercado de sabores del litoral', 'Gastronomía', 'Productores regionales ofrecen quesos, dulces, conservas y comidas caseras en una jornada para descubrir la cocina local.', '2026-12-19T11:00:00-03:00', '2026-12-19T19:00:00-03:00', 'Predio Costa Surubí', 'Goya, Corrientes', 'Sabores del Paraná', 'published'],
  ['noche-de-museos-goya', 'Noche de los museos de Goya', 'Cultura', 'Los espacios culturales de la ciudad extienden sus horarios con visitas guiadas, música y relatos sobre la historia goyana.', '2026-12-20T18:00:00-03:00', '2026-12-20T23:30:00-03:00', 'Museo de la Ciudad', 'Goya, Corrientes', 'Museo de la Ciudad', 'published'],
  ['taller-fotografia-naturaleza', 'Taller de fotografía de naturaleza', 'Comunidad', 'Aprendé técnicas para fotografiar paisajes, aves y atardeceres durante una salida práctica por los humedales cercanos.', '2027-01-09T09:00:00-03:00', '2027-01-09T13:00:00-03:00', 'Reserva Isla Las Damas', 'Goya, Corrientes', 'Miradas del Iberá', 'published'],
  ['cine-bajo-las-estrellas', 'Cine bajo las estrellas', 'Cultura', 'Proyección al aire libre de una película familiar, con mantas, reposeras y un pequeño espacio de comidas y bebidas.', '2027-01-15T20:30:00-03:00', '2027-01-15T23:30:00-03:00', 'Plaza Mitre', 'Goya, Corrientes', 'Cine Comunitario Goya', 'published'],
  ['regata-verano-parana', 'Regata de verano del Paraná', 'Deportes', 'Competencia náutica y encuentro deportivo con embarcaciones de clubes de la región y actividades para quienes acompañen desde la costa.', '2027-01-17T07:30:00-03:00', '2027-01-17T15:00:00-03:00', 'Club Náutico Goya', 'Goya, Corrientes', 'Club Náutico Goya', 'published'],
  ['feria-libros-verano', 'Feria de libros de verano', 'Cultura', 'Librerías, autores y lectores comparten novedades, lecturas breves y recomendaciones para disfrutar durante las vacaciones.', '2027-01-23T17:00:00-03:00', '2027-01-23T22:00:00-03:00', 'Casa de la Cultura', 'Goya, Corrientes', 'Biblioteca Popular', 'published'],
  ['encuentro-mate-musica', 'Encuentro de mate y música', 'Comunidad', 'Tarde de guitarreadas, artistas locales y charlas sobre las costumbres que se reúnen alrededor del mate.', '2027-01-30T18:00:00-03:00', '2027-01-30T22:00:00-03:00', 'Paseo de los Artesanos', 'Goya, Corrientes', 'Raíces Goyanas', 'published'],
  ['carnaval-barrial-san-martin', 'Carnaval barrial de San Martín', 'Comunidad', 'Comparsas, disfraces y percusión recorren el barrio en una celebración abierta, colorida y pensada para compartir en familia.', '2027-02-06T20:00:00-03:00', '2027-02-06T23:30:00-03:00', 'Barrio San Martín', 'Goya, Corrientes', 'Comisión Vecinal San Martín', 'published'],
  ['taller-huerta-urbana', 'Taller de huerta urbana', 'Comunidad', 'Una introducción práctica al cultivo en espacios pequeños, compostaje y producción de alimentos saludables en casa.', '2027-02-13T09:30:00-03:00', '2027-02-13T12:30:00-03:00', 'Vivero Municipal', 'Goya, Corrientes', 'Ambiente Goya', 'published'],
  ['pequenos-chefs-corrientes', 'Pequeños chefs de Corrientes', 'Gastronomía', 'Actividad de cocina para niños y niñas con recetas regionales, ingredientes de estación y acompañamiento de cocineros locales.', '2027-02-20T10:00:00-03:00', '2027-02-20T13:00:00-03:00', 'Mercado Municipal', 'Goya, Corrientes', 'Cocina con Identidad', 'published'],
  ['festival-del-rio', 'Festival del río', 'Música', 'Jornada cultural frente al Paraná con bandas locales, feria de diseño, juegos y propuestas para disfrutar el paisaje.', '2027-03-06T16:00:00-03:00', '2027-03-06T23:00:00-03:00', 'Predio Costa Surubí', 'Goya, Corrientes', 'Municipalidad de Goya', 'published'],
  ['muestra-artistas-emergentes', 'Muestra de artistas emergentes', 'Cultura', 'Exposición colectiva de ilustradores, fotógrafos y artistas visuales que presentan nuevas miradas sobre la ciudad.', '2027-03-13T19:00:00-03:00', '2027-03-13T22:00:00-03:00', 'Galería del Puerto', 'Goya, Corrientes', 'Galería del Puerto', 'published'],
  ['torneo-ajedrez-plaza', 'Torneo de ajedrez en la plaza', 'Deportes', 'Partidas abiertas y torneo por categorías para principiantes y jugadores experimentados, con tableros disponibles para el público.', '2027-03-20T14:00:00-03:00', '2027-03-20T19:00:00-03:00', 'Plaza San Martín', 'Goya, Corrientes', 'Club de Ajedrez Goya', 'published'],
  ['coro-ciudad-concierto', 'Concierto del Coro de la Ciudad', 'Música', 'El coro municipal presenta un repertorio de canciones populares, música coral argentina y composiciones del litoral.', '2027-03-27T20:00:00-03:00', '2027-03-27T22:00:00-03:00', 'Iglesia Catedral', 'Goya, Corrientes', 'Coro Municipal de Goya', 'published'],
  ['feria-trueque-semillas', 'Feria de trueque de semillas', 'Comunidad', 'Intercambio de semillas, plantines y conocimientos para impulsar huertas familiares y una red de productores locales.', '2027-04-03T09:00:00-03:00', '2027-04-03T13:00:00-03:00', 'Vivero Municipal', 'Goya, Corrientes', 'Red de Huertas Goyanas', 'published'],
  ['pesca-deportiva-otoño', 'Encuentro de pesca deportiva de otoño', 'Deportes', 'Competencia recreativa con inscripción previa, conciencia ambiental y una jornada de encuentro a orillas del río.', '2027-04-10T07:00:00-03:00', '2027-04-10T16:00:00-03:00', 'Ribera del río Paraná', 'Goya, Corrientes', 'Club de Pesca Goya', 'published'],
  ['tarde-juegos-familia', 'Tarde de juegos en familia', 'Comunidad', 'Juegos de mesa, desafíos cooperativos y actividades lúdicas para compartir entre distintas generaciones.', '2027-04-17T15:00:00-03:00', '2027-04-17T19:00:00-03:00', 'Parque Municipal', 'Goya, Corrientes', 'Jugar Juntos', 'published'],
  ['seminario-historia-goyana', 'Seminario de historia goyana', 'Cultura', 'Investigadores y vecinos conversan sobre documentos, relatos y momentos que ayudaron a construir la identidad de Goya.', '2027-04-24T17:00:00-03:00', '2027-04-24T20:00:00-03:00', 'Archivo Histórico Municipal', 'Goya, Corrientes', 'Archivo Histórico Municipal', 'published'],
  ['feria-diseno-local', 'Feria de diseño local', 'Gastronomía', 'Emprendimientos de diseño, decoración y objetos hechos a mano presentan sus colecciones y procesos de trabajo.', '2027-05-01T16:00:00-03:00', '2027-05-01T22:00:00-03:00', 'Paseo Costero', 'Goya, Corrientes', 'Diseño Goya', 'published'],
  ['taller-canto-comunitario', 'Taller de canto comunitario', 'Música', 'Un encuentro abierto para aprender canciones, respiración y ejercicios vocales sin necesidad de experiencia previa.', '2027-05-08T10:00:00-03:00', '2027-05-08T12:30:00-03:00', 'Casa de la Cultura', 'Goya, Corrientes', 'Voces del Paraná', 'pending'],
  ['jornada-movilidad-sustentable', 'Jornada de movilidad sustentable', 'Comunidad', 'Charla y recorrido en bicicleta para pensar una ciudad más accesible, segura y amigable con el ambiente.', '2027-05-15T09:00:00-03:00', '2027-05-15T13:00:00-03:00', 'Plaza Italia', 'Goya, Corrientes', 'Goya Sustentable', 'rescheduled'],
  ['encuentro-poesia-ribera', 'Encuentro de poesía de la ribera', 'Cultura', 'Lectura abierta de poemas, micrófono para autores locales y música en vivo en un encuentro dedicado a las voces del litoral.', '2027-05-22T18:00:00-03:00', '2027-05-22T21:00:00-03:00', 'Centro Cultural del Puerto', 'Goya, Corrientes', 'Palabras del Paraná', 'published'],
]

// Inserta eventos de ejemplo sin sobrescribir registros que ya existan.
async function seedEvents() {
  let inserted = 0
  for (const [slug, title, category, description, startAt, endAt, location, city, organization, status] of events) {
    const result = await pool.query(
      `INSERT INTO events (
        slug, title, category, description, image, start_at, end_at,
        location, city, organization, organizer_email, ticket_type, status, submitted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'free',$12,CURRENT_DATE)
      ON CONFLICT (slug) DO NOTHING`,
      [slug, title, category, description, image, startAt, endAt, location, city, organization, 'demo@agendaciudad.com', status]
    )
    inserted += result.rowCount
  }
  console.log(`Eventos insertados: ${inserted}. Registros del seed: ${events.length}.`)
}

seedEvents()
  .catch((error) => {
    console.error('No se pudieron cargar los eventos:', error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())