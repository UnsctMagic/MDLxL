import { Euler, Quaternion } from 'three';

/** Quaternion values to XYZ Euler degrees. */
export const quaternionToDegrees = values => new Euler().setFromQuaternion(new Quaternion().fromArray(values).normalize(), 'XYZ').toArray().slice(0, 3).map(v => v * 180 / Math.PI);
/** XYZ Euler degrees to a Quaternion. */
export const degreesToQuaternion = degrees => new Quaternion().setFromEuler(new Euler(...degrees.map(v => v * Math.PI / 180), 'XYZ'));
