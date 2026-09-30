# Isla Jurásica

**Jugar:** https://ceviljm-png.github.io/isla-jurasica/

Juego de tablero de comprar dinosaurios, construir recintos y arruinar a los rivales.
Es una app web instalable (PWA): funciona igual en Android, en macOS y en cualquier navegador, y se juega sin conexión.

- De 2 a 4 jugadores: personas que se pasan el dispositivo y rivales que lleva la máquina (fácil, normal o difícil).
- Tres tableros: **Clásica** (40 casillas, 22 dinosaurios), **Rápida** (el mismo tablero, 20 rondas) y **Reducida** (24 casillas, 12 dinosaurios).
- Los dinosaurios van de menos a más populares: el Compsognathus es el más barato y el Tyrannosaurus rex, el más caro.

## Jugar en local

```bash
python3 serve.py
```

y abre http://localhost:8140. También funciona abriendo `index.html` con doble clic.

## Instalar

En Android (Chrome): menú ⋮ → *Añadir a pantalla de inicio*.
En macOS (Chrome o Edge): icono de instalar en la barra de direcciones. En Safari: *Archivo → Añadir al Dock*.

## Comprobar las reglas

```bash
npm test
```

Juega cientos de partidas máquina contra máquina y comprueba que no se rompe ninguna regla.
