-- Crear la base de datos (si no existe) y seleccionarla
CREATE DATABASE IF NOT EXISTS f1_scores;
USE f1_scores;

-- Tabla Usuario: Solo se tendrá un usuario administrador
CREATE TABLE Usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user'
);

-- Tabla Equipo: Representa cada uno de los equipos que compiten
CREATE TABLE Equipo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL UNIQUE
);

-- Tabla GP: Información de cada Gran Premio
CREATE TABLE GP (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    gp_date DATE NOT NULL
);

-- Tabla Piloto: Información de los pilotos
CREATE TABLE Piloto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    shortname VARCHAR(3) NOT NULL
);

-- Tabla Seleccion: Registra la selección de pilotos por equipo en cada GP
CREATE TABLE Seleccion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    gp_id INT NOT NULL,
    piloto_id INT NOT NULL,
    points INT DEFAULT 0,
    CONSTRAINT fk_equipo FOREIGN KEY (equipo_id) REFERENCES Equipo(id) ON DELETE CASCADE,
    CONSTRAINT fk_gp FOREIGN KEY (gp_id) REFERENCES GP(id) ON DELETE CASCADE,
    CONSTRAINT fk_piloto FOREIGN KEY (piloto_id) REFERENCES Piloto(id) ON DELETE CASCADE,
    UNIQUE (gp_id, piloto_id) -- Evita que se repita un mismo piloto en un GP
);
