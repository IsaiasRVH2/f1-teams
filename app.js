// app.js
require('dotenv').config(); // Carga las variables de entorno

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configurar carpeta pública para servir CSS, JS, etc.
app.use(express.static(path.join(__dirname, 'public')));

//Configuración de la sesión
app.use(session({
  secret: process.env.SESSION_KEY, 
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } 
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    // Si ya hay sesión, redirigir a la página para agregar pilotos
    return res.redirect('/');
  }
  next();
}

app.get('/api/proxy/nextgp', async (req, res) => {
    try {
      const apiResponse = await fetch('https://f1connectapi.vercel.app/api/current/next');
      const data = await apiResponse.json();
      res.json(data);
    } catch (error) {
      console.error('Error en el proxy:', error);
      res.status(500).json({ error: 'Error al obtener datos del próximo GP' });
    }
  });

// Configuración de conexión a la base de datos usando variables de entorno
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
};

// Ruta para mostrar el formulario para agregar un equipo
app.get('/add-team', (req, res) => {
  res.render('add-team', { user: req.session.userId, error: null, success: null });
});

// Ruta para procesar el formulario de agregar un equipo
app.post('/add-team', async (req, res) => {
  const { teamName } = req.body;
  if (!teamName) {
    return res.render('add-team', { user: req.session.userId, error: 'El nombre del equipo es obligatorio.', success: null });
  }
  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar si el equipo ya existe
    const [existing] = await connection.execute('SELECT id FROM Equipo WHERE team_name = ?', [teamName]);
    if (existing.length > 0) {
      await connection.end();
      return res.render('add-team', { user: req.session.userId, error: 'El equipo ya existe.', success: null });
    }

    // Insertar el nuevo equipo
    await connection.execute('INSERT INTO Equipo (team_name) VALUES (?)', [teamName]);
    await connection.end();

    res.render('add-team', { user: req.session.userId, error: null, success: 'Equipo agregado exitosamente.' });
  } catch (error) {
    console.error('Error al agregar equipo:', error);
    res.render('add-team', { user: req.session.userId, error: 'Error al agregar el equipo. Intente más tarde.', success: null });
  }
});

app.get('/add-user', (req, res) => {
  res.render('add-user', { user: req.session.userId, error: null, success: null });
});

// Ruta para procesar el formulario de agregar usuario
app.post('/add-user', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.render('add-user', {user: req.session.userId, error: 'Todos los campos son requeridos.', success: null });
  }
  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar si ya existe un usuario con ese username
    const [existing] = await connection.execute('SELECT id FROM Usuario WHERE username = ?', [username]);
    if (existing.length > 0) {
      await connection.end();
      return res.render('add-user', { user: req.session.userId, error: 'El usuario ya existe.', success: null });
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar el nuevo usuario en la base de datos (rol por defecto: 'user')
    await connection.execute('INSERT INTO Usuario (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, 'user']);
    await connection.end();

    res.render('add-user', {user: req.session.userId, error: null, success: 'Usuario agregado exitosamente.' });
  } catch (error) {
    console.error('Error al agregar usuario:', error);
    res.render('add-user', { user: req.session.userId, error: 'Error al agregar usuario. Intente más tarde.', success: null });
  }
});

// Ruta para mostrar la página de login
app.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', {user: req.session.userId, error: null });
});

// Ruta para procesar el login usando bcrypt para comparar contraseñas
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT id, username, password, role FROM Usuario WHERE username = ?',
      [username]
    );
    await connection.end();
    
    if (rows.length > 0) {
      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        // Guardamos la información del usuario en la sesión
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        console.log('Valor de req.session.user:', req.session.userId);
        return res.redirect('/');
      } else {
        return res.render('login', { user: req.session.userId, error: 'Usuario o contraseña incorrectos.' });
      }
    } else {
      return res.render('login', { user: req.session.userId, error: 'Usuario o contraseña incorrectos.' });
    }
  } catch (error) {
    console.error('Error en /login:', error);
    return res.render('login', { user: req.session.userId, error: 'Error en el servidor. Intente más tarde.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
    }
    res.redirect('/');
  });
});

// Ruta protegida para agregar pilotos
app.get('/add-drivers', isAuthenticated, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Obtener todos los GPs disponibles
    const [gps] = await connection.execute('SELECT id, name FROM GP ORDER BY gp_date ASC');
    
    // Obtener todos los equipos
    const [teams] = await connection.execute('SELECT id, team_name FROM Equipo ORDER BY team_name');
    
    // Obtener todos los pilotos
    const [pilots] = await connection.execute('SELECT id, name, surname FROM Piloto ORDER BY name');
    
    await connection.end();
    
    res.render('add-drivers', { user: req.session.userId, gps, teams, pilots, error: null, success: null });
  } catch (error) {
    console.error('Error en GET /add-drivers:', error);
    res.render('add-drivers', { user: req.session.userId, gps: [], teams: [], pilots: [], error: 'Error al cargar la página.', success: null });
  }
});

app.post('/add-drivers', isAuthenticated, async (req, res) => {
  const { gpId, drivers } = req.body;
  if (!gpId || !drivers) {
    return res.render('add-drivers', { 
      user: req.session.userId,
      gps: [], 
      teams: [], 
      pilots: [], 
      error: 'Datos incompletos.', 
      success: null 
    });
  }
  
  try {
    const connection = await mysql.createConnection(dbConfig);

    // Cargar datos al inicio para usarlos en caso de error
    const [gps] = await connection.execute('SELECT id, name FROM GP ORDER BY gp_date ASC');
    const [teams] = await connection.execute('SELECT id, team_name FROM Equipo ORDER BY team_name');
    const [pilots] = await connection.execute('SELECT id, name, surname FROM Piloto ORDER BY name');
    
    // Reunir todos los pilotos seleccionados en un solo arreglo
    const allPilots = []; // Contendrá todos los pilotos seleccionados en este formulario
    for (const key in drivers) {
      // Extraemos el valor oculto 'teamId' y los pilotos
      const { teamId, pilot1, pilot2 } = drivers[key];
      allPilots.push(pilot1, pilot2);
    }
    
    // Verificar si hay duplicados dentro del propio formulario
    const pilotSet = new Set(allPilots);
    if (pilotSet.size < allPilots.length) {
      await connection.end();
      return res.render('add-drivers', {
        user: req.session.userId,
        gps,
        teams,
        pilots,
        error: 'Al menos uno de los pilotos seleccionados ya está asignado en este GP.',
        success: null
      });
    }
    
    // Revisar si alguno de esos pilotos ya existe en la DB para este GP
    const placeholders = allPilots.map(() => '?').join(',');
    const query = `
      SELECT piloto_id 
      FROM Seleccion 
      WHERE gp_id = ? 
      AND piloto_id IN (${placeholders})
    `;
    const [rows] = await connection.execute(query, [gpId, ...allPilots]);
    if (rows.length > 0) {
      await connection.end();
      return res.render('add-drivers', {
        user: req.session.userId,
        gps,
        teams,
        pilots,
        error: 'Al menos uno de los pilotos seleccionados ya está asignado en este GP.',
        success: null
      });
    }
    
    //Si pasa todas las validaciones, insertar en la DB
    for (const key in drivers) {
      const { teamId: hiddenTeamId, pilot1, pilot2 } = drivers[key];
      console.log(hiddenTeamId, gpId, pilot1);
      console.log(hiddenTeamId, gpId, pilot2);
      await connection.execute(
        'INSERT INTO Seleccion (equipo_id, gp_id, piloto_id, points) VALUES (?, ?, ?, 0)',
        [hiddenTeamId, gpId, pilot1]
      );
      await connection.execute(
        'INSERT INTO Seleccion (equipo_id, gp_id, piloto_id, points) VALUES (?, ?, ?, 0)',
        [hiddenTeamId, gpId, pilot2]
      );
    }
    
    await connection.end();
    return res.render('add-drivers', {
      user: req.session.userId,
      gps,
      teams,
      pilots,
      error: null,
      success: 'Selecciones guardadas exitosamente.'
    });
  } catch (error) {
    console.error('Error al guardar selecciones:', error);
    const connection = await mysql.createConnection(dbConfig);
    const [gps] = await connection.execute('SELECT id, name FROM GP ORDER BY gp_date ASC');
    const [teams] = await connection.execute('SELECT id, team_name FROM Equipo ORDER BY team_name');
    const [pilots] = await connection.execute('SELECT id, name, surname FROM Piloto ORDER BY name');
    await connection.end();
    
    return res.render('add-drivers', {
      user: req.session.userId,
      gps,
      teams,
      pilots,
      error: 'Error al guardar selecciones. Intente más tarde.',
      success: null
    });
  }
});

app.get('/', async (req, res) => {
    try {
      const connection = await mysql.createConnection(dbConfig);
  
      const [gpRows] = await connection.execute(
        'SELECT gp_id FROM Seleccion ORDER BY gp_id DESC LIMIT 1'
      );
      let currentGP = gpRows[0] || { id: null};
  
      const [teamsRows] = await connection.execute(
         `SELECT Equipo.team_name, 
                GROUP_CONCAT(CONCAT(Piloto.name, ' ', Piloto.surname) SEPARATOR ', ') AS pilotos,
                SUM(Seleccion.points) AS puntos
          FROM Equipo
          JOIN Seleccion ON Equipo.id = Seleccion.equipo_id
          JOIN Piloto ON Seleccion.piloto_id = Piloto.id
          WHERE Seleccion.gp_id = ?
          GROUP BY Equipo.id
          ORDER BY puntos DESC;`,
        [currentGP.gp_id]
      );

      res.render('index', { user: req.session.userId, teams: teamsRows, currentGP });
      await connection.end();
    } catch (error) {
      console.error('Error en la ruta /:', error);
      res.status(500).send('Error en el servidor');
    }
  });

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

async function executeGPTask(race) {
  console.log(`🚀 Ejecutando tarea para el GP "${race.raceName}" (ID: ${race.raceId}) a las ${new Date().toLocaleString()}`);
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    //  Obtener el ID del GP
    const [gpRows] = await connection.execute(
      'SELECT id FROM GP WHERE name = ?',
      [race.raceName]
    );

    if (gpRows.length === 0) {
      console.log(`⚠️ No se encontró el GP "${race.raceName}" en la base de datos.`);
      return;
    }

    const gpId = gpRows[0].id;

    // Obtener registros en "Seleccion" que coincidan con el GP
    const [selectionRows] = await connection.execute(
      'SELECT * FROM Seleccion WHERE gp_id = ?',
      [gpId]
    );

    if (selectionRows.length === 0) {
      console.log(`No hay selecciones registradas para el GP "${race.raceName}".`);
      return;
    }

    // Obtener los pilotos seleccionados
    let drivers = {};
    for (const selection of selectionRows) {
      const [pilotRows] = await connection.execute(
        'SELECT id, shortname FROM Piloto WHERE id = ?',
        [selection.piloto_id]
      );

      if (pilotRows.length > 0) {
        drivers[pilotRows[0].shortname] = pilotRows[0].id;
      }
    }

    // Obtener datos de la API de F1
    const response = await fetch(`https://f1api.dev/api/${race.season}/${race.round}/race`);
    if (!response.ok) {
      throw new Error('Error al obtener datos de la carrera.');
    }

    const data = await response.json();
    const results = data.races.results;

    // Verificar y asignar puntos a los pilotos seleccionados
    for (const result of results) {
      if (drivers.hasOwnProperty(result.driver.shortName)) {
        const driverId = drivers[result.driver.shortName];
        const points = result.points;

        
        // Guardar los puntos en la base de datos
        await connection.execute(
          'UPDATE Seleccion SET points = ? WHERE gp_id = ? AND piloto_id = ?',
          [points, gpId, driverId]
        );

      }
    }
    console.log(`Puntos asignados a los pilotos seleccionados.`);
  } catch (error) {
    console.error("Error al ejecutar tarea para el GP:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Función para programar la tarea para el próximo GP usando la API
async function scheduleNextGPTask() {
  try {
    // Consultamos el endpoint de la API
    const response = await fetch('https://f1api.dev/api/current/next');
    if (!response.ok) {
      throw new Error('Error al obtener el próximo GP de la API.');
    }
    const data = await response.json();
    
    // Verificar que la API retorne un array de carreras y obtener el primer elemento
    if (!data.race || data.race.length === 0) {
      console.log("La API no devolvió información del próximo GP.");
      return;
    }
    
    const race = data.race[0]; // Usamos el primer GP del array
    
    const raceDate = race.schedule.race.date;
    const raceTime = race.schedule.race.time; // ya incluye la "Z" para UTC

    // Combina la fecha y hora en un objeto Date; al usar formato ISO con "Z", se interpretará como UTC
    const gpDateTime = new Date(`${raceDate}T${raceTime}`);
    
    // Programamos la tarea para 3 horas después del inicio del GP
    const scheduledTime = new Date(gpDateTime.getTime() + 3 * 60 * 60 * 1000);
    const now = new Date();
    const delay = scheduledTime - now;
    
    console.log(`Programando tarea para el GP "${race.raceName}" a las ${scheduledTime.toLocaleString()} (en ${delay} ms)`);
    
    if (delay <= 0) {
      // Si la hora ya pasó, ejecutamos inmediatamente y reprogramamos
      executeGPTask(race);
      scheduleNextGPTask();
    } else {
      setTimeout(() => {
        executeGPTask(race);
        // Una vez ejecutada la tarea, se reprograma para el siguiente GP
        scheduleNextGPTask();
      }, delay);
    }
  } catch (error) {
    console.error("Error al programar la tarea para el próximo GP:", error);
    // Si falla la obtención de datos, reintenta después de un tiempo (por ejemplo, 5 minutos)
    setTimeout(scheduleNextGPTask, 5 * 60 * 1000);
  }
}

// Iniciar la programación al arrancar el servidor
scheduleNextGPTask();