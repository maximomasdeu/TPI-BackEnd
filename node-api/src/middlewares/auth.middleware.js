import jwt from 'jsonwebtoken'

const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required')
}

// Exige un Bearer token válido y adjunta sus datos decodificados al request.
export function requireLogin(request, response, next) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Se requiere iniciar sesión' })
    return
  }

  try {
    request.user = jwt.verify(authorization.slice(7), jwtSecret)
    next()
  } catch {
    response.status(401).json({ message: 'Sesión inválida' })
  }
}

// Permite continuar sin sesión; si el token es válido, agrega el usuario al request.
export function optionalLogin(request, response, next) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    next()
    return
  }

  try {
    request.user = jwt.verify(authorization.slice(7), jwtSecret)
  } catch {
    // Las rutas públicas siguen funcionando si no hay una sesión válida.
  }
  next()
}
