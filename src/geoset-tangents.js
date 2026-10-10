/** Tangents follow UV derivatives, with an orthonormal fallback for thickness
 * walls whose original-image UVs are necessarily degenerate across depth. */
export function forgeTangents(g) {
  const count = g.Vertices.length / 3, a = new Float64Array(count * 3), b = new Float64Array(count * 3), uv = g.TVertices[0], result = new Float32Array(count * 4);
  for (let i = 0; i < g.Faces.length; i += 3) {
    const [p, q, r] = g.Faces.subarray(i, i + 3), du1 = uv[q * 2] - uv[p * 2], dv1 = uv[q * 2 + 1] - uv[p * 2 + 1], du2 = uv[r * 2] - uv[p * 2], dv2 = uv[r * 2 + 1] - uv[p * 2 + 1], det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    for (let axis = 0; axis < 3; axis++) { const e1 = g.Vertices[q * 3 + axis] - g.Vertices[p * 3 + axis], e2 = g.Vertices[r * 3 + axis] - g.Vertices[p * 3 + axis], tangent = (e1 * dv2 - e2 * dv1) / det, bitangent = (e2 * du1 - e1 * du2) / det; for (const v of [p, q, r]) { a[v * 3 + axis] += tangent; b[v * 3 + axis] += bitangent; } }
  }
  for (let i = 0; i < count; i++) {
    const n = Array.from(g.Normals.subarray(i * 3, i * 3 + 3)), t = Array.from(a.subarray(i * 3, i * 3 + 3)), dot = t.reduce((sum, value, k) => sum + value * n[k], 0); let projected = t.map((v, k) => v - dot * n[k]), length = Math.hypot(...projected);
    if (length < 1e-10) { const axis = Math.abs(n[0]) < .8 ? [1, 0, 0] : [0, 1, 0], d = axis.reduce((sum, value, k) => sum + value * n[k], 0); projected = axis.map((v, k) => v - d * n[k]); length = Math.hypot(...projected) || 1; }
    projected = projected.map(v => v / length); const cross = [n[1] * projected[2] - n[2] * projected[1], n[2] * projected[0] - n[0] * projected[2], n[0] * projected[1] - n[1] * projected[0]], handedness = cross.reduce((sum, value, k) => sum + value * b[i * 3 + k], 0) < 0 ? -1 : 1;
    result.set([...projected, handedness], i * 4);
  }
  return result;
}
