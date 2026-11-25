import jwt from 'jsonwebtoken'

const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required')
}

function readUser(authorization) {
  try {
    return jwt.verify(authorization.slice(7), jwtSecret)
  } catch {
    return undefined
  }
}

// Exige un Bearer token válido y adjunta sus datos decodificados al request.
export function requireLogin(request, response, next) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Se requiere iniciar sesión' })
    return
  }

  const user = readUser(authorization)
  if (user === undefined) {
    response.status(401).json({ message: 'Sesión inválida' })
    return
  }

  request.user = user
  next()
}

// Permite continuar sin sesión; si el token es válido, agrega el usuario al request.
export function optionalLogin(request, response, next) {
  const authorization = request.headers.authorization
  if (authorization?.startsWith('Bearer ')) {
    const user = readUser(authorization)
    if (user !== undefined) request.user = user
  }
  next()
}
