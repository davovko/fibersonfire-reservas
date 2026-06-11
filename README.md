# GymApp — Sistema de Reservas

App web de reservas para gym. Funciona en cualquier dispositivo (Android, iOS, PC).

## Archivos del proyecto

```
gym-app/
├── index.html           ← App completa
├── css/
│   └── styles.css       ← Estilos
├── js/
│   ├── firebase.js      ← Configuración Firebase
│   └── app.js           ← Toda la lógica
└── firestore.rules      ← Reglas de seguridad (copiar en Firebase Console)
```

---

## Paso 1 — Subir a GitHub Pages

1. Ve a **github.com** → "New repository"
2. Nombre: `gym-reservas` → **Public** → "Create repository"
3. Sube todos los archivos (arrastra o usa Git)
4. Ve a **Settings → Pages**
5. Source: `main` branch → carpeta `/root` → **Save**
6. Tu app quedará en: `https://TU-USUARIO.github.io/gym-reservas`

---

## Paso 2 — Configurar dominio autorizado en Firebase

Para que el login con Google funcione desde GitHub Pages:

1. Ve a Firebase Console → **Authentication → Settings → Authorized domains**
2. Clic en **"Add domain"**
3. Agrega: `TU-USUARIO.github.io`
4. **Save**

---

## Paso 3 — Aplicar reglas de seguridad en Firestore

1. Ve a Firebase Console → **Firestore → Rules**
2. Borra las reglas actuales
3. Pega el contenido del archivo `firestore.rules`
4. Clic en **Publish**

---

## Paso 4 — Crear tu cuenta de admin

1. Abre la app y entra con tu cuenta Google
2. Tu usuario queda en estado "pending"
3. Ve a Firebase Console → **Firestore → users**
4. Busca tu documento (por tu email)
5. Edita los campos:
   - `status`: cambia `pending` → `active`
   - `role`: cambia `user` → `admin`
6. ¡Listo! Recarga la app y entrarás como admin

---

## Roles del sistema

| Rol | Puede hacer |
|-----|------------|
| `admin` | Todo: usuarios, horarios, pagos, rutinas |
| `trainer` | Ver inscritos, asignar rutinas, notas de alumnos |
| `user` | Reservar clases, ver rutinas, ver historial |

## Estados de usuario

| Estado | Descripción |
|--------|-------------|
| `pending` | Recién registrado, espera aprobación |
| `active` | Acceso completo |
| `blocked` | Sin acceso, no puede reservar |
