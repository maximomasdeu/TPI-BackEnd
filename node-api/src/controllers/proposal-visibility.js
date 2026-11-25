export function proposalVisibility(user, publicStatuses, values, includeDeleted = false) {
  if (user?.role === 'admin') {
    return includeDeleted ? 'TRUE' : "status NOT IN ('deleted', 'cancelled')"
  }

  const publicStatusIndex = values.push(publicStatuses)
  const publicCondition = `status = ANY($${publicStatusIndex}::text[])`
  if (user?.role !== 'organizer' || !user.email) return publicCondition

  const emailIndex = values.push(user.email)
  return `(${publicCondition} OR (organizer_email = $${emailIndex} AND status NOT IN ('deleted', 'cancelled')))`
}
