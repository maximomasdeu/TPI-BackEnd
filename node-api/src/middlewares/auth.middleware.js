import jwt from 'jsonwebtoken'

const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required')
}

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
