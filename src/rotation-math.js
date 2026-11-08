import { Euler, Quaternion, Vector3 } from 'three';

/** Quaternion values to XYZ Euler degrees. */
export const quaternionToDegrees = values => new Euler().setFromQuaternion(new Quaternion().fromArray(values).normalize(), 'XYZ').toArray().slice(0, 3).map(v => v * 180 / Math.PI);
/** XYZ Euler degrees to a Quaternion. */
export const degreesToQuaternion = degrees => new Quaternion().setFromEuler(new Euler(...degrees.map(v => v * Math.PI / 180), 'XYZ'));
/**
 * A node's local rotation after turning it `degrees` around a world `axis`
 * (right-hand rule, as the Rotate gizmo reports). `parent` is the parent's world
 * rotation: world = parent × local, so the axis is carried into the parent's space.
 */
export function turnLocalRotation(local, parent, axis, degrees) {
  const inParent = new Vector3(...axis).applyQuaternion(new Quaternion().fromArray(parent).normalize().invert()).normalize();
  return new Quaternion().setFromAxisAngle(inParent, degrees * Math.PI / 180).multiply(new Quaternion().fromArray(local).normalize()).toArray();
}
