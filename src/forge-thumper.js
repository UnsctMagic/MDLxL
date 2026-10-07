import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

export const THUMPER_COLORS = ['#0c0e12', '#202329', '#393d44', '#5b6067', '#7f848b', '#c20c14', '#ff1a20', '#e6e8eb'];
export const THUMPER_TEXTURE = 'MDLxL_Forge\\thumperxl-v1.tga';
export function thumperImage() {
  const width = 128, height = 16, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const hex = THUMPER_COLORS[Math.floor(x / 16)];
    data.set([1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(255), (y * width + x) * 4);
  }
  return { width, height, data };
}

/** Front contours and plate boundaries traced from public/branding/MDLxL.png.
 * Mirror its wireframe half into a complete helmet, retaining the horns,
 * slanted eye sockets, cheek plates and long central ridge. No imported mesh.
 */
export function thumperGeometry() {
  const vertices = [], uv = [];
  const front = x => .1 + .22 * (1 - Math.abs(x - 626) / 560);
  const point = ([x, y], z) => [(x - 626) / 1120, (611 - y) / 1096, z];
  const triangle = (a, b, c, color) => {
    vertices.push(...a, ...b, ...c);
    uv.push((color + .25) / 8, .25, (color + .75) / 8, .25, (color + .5) / 8, .75);
  };
  const plate = (outline, color, offset = 0, solid = true) => {
    const contour = outline.map(p => new Vector2(p[0], -p[1]));
    for (const [i, j, k] of ShapeUtils.triangulateShape(contour, [])) {
      const a = point(outline[i], front(outline[i][0]) + offset), b = point(outline[j], front(outline[j][0]) + offset), c = point(outline[k], front(outline[k][0]) + offset);
      triangle(a, b, c, color);
      if (solid) triangle([c[0], c[1], -.18], [b[0], b[1], -.18], [a[0], a[1], -.18], 1);
    }
    if (solid) for (let i = 0; i < outline.length; i++) {
      const a = point(outline[i], front(outline[i][0]) + offset), b = point(outline[(i + 1) % outline.length], front(outline[(i + 1) % outline.length][0]) + offset), c = [b[0], b[1], -.18], d = [a[0], a[1], -.18];
      if (ShapeUtils.isClockWise(contour)) { triangle(a, b, c, 2); triangle(a, c, d, 2); }
      else { triangle(a, d, c, 2); triangle(a, c, b, 2); }
    }
  };
  const leftBody = [[626,139],[406,327],[369,374],[298,374],[280,636],[280,756],[246,888],[331,950],[398,1010],[517,1118],[537,1084],[579,1115],[626,1159]];
  const mirror = points => points.map(([x, y]) => [1252 - x, y]);
  plate([...leftBody, ...mirror(leftBody.slice(1, -1)).reverse()], 2);
  const horn = [[298,374],[233,309],[221,236],[269,170],[299,131],[310,69],[290,63],[203,150],[112,220],[70,364],[150,533],[280,636],[330,565],[345,471],[369,374]];
  for (const flip of [false, true]) {
    const side = points => flip ? mirror(points).reverse() : points;
    plate(side(horn), 3, -.02);
    // Horn ridges follow the same visible facets as the logo's wireframe.
    plate(side([[310,69],[203,150],[269,170]]), 4, .004, false);
    plate(side([[203,150],[112,220],[221,236],[269,170]]), 3, .004, false);
    plate(side([[112,220],[70,364],[233,309],[221,236]]), 4, .004, false);
    plate(side([[70,364],[150,533],[330,565],[233,309]]), 3, .004, false);
    plate(side([[150,533],[280,636],[330,565]]), 2, .006, false);
    plate(side([[626,139],[406,327],[330,565],[370,604],[578,692],[626,719]]), 3, .008, false);
    plate(side([[626,257],[406,457],[406,581],[578,605],[626,456]]), 4, .012, false);
    // Black eye socket continues into the narrow cheek/nose opening.
    plate(side([[370,604],[578,692],[579,1115],[532,1085],[528,777],[383,696]]), 0, .018, false);
    plate(side([[330,565],[370,604],[370,695],[519,777],[517,1118],[398,1010],[246,888],[280,756]]), 3, .02, false);
    plate(side([[330,708],[398,813],[517,896],[517,1118],[398,1010],[331,950]]), 2, .023, false);
    plate(side([[626,139],[607,166],[603,704],[588,740],[588,1120],[626,1159]]), 4, .028, false);
    plate(side([[389,631],[555,699],[509,751]]), 6, .032, false);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geometry.computeVertexNormals();
  return geometry;
}
