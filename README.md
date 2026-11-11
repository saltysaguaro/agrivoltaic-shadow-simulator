# Agrivoltaic Shadow Simulator

A browser-based Three.js tool for designing a photovoltaic array and watching its ground shadows move over one local day. All rendering and GIF encoding run in the browser. The initial example is a 72-module, 39.6 kW fixed-tilt array in Tucson, Arizona, on June 21, 2026.

[View an exported single-axis tracker animation for the same Tucson site and date](examples/tucson-single-axis.gif).

## Run locally

Use Node.js 22.12 or later and a browser with WebGL 2.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Run `npm test` for model checks and `npm run build` for the deployable static site in `dist/`.

## Design and animate

1. In **System**, choose fixed tilt, single-axis tracking, dual-axis tracking, vertical bifacial, or a raised pergola. Set module dimensions, cell construction, axis height, post width, table orientation, modules per table, pitch, row grouping, aisles, and azimuth. The tracker settings include rotation limits and single-axis backtracking. Pergola rows can be aligned or staggered. Under **Crops**, choose tomato, zucchini, potato, lettuce, or corn. One planting line runs through the center of each aisle between PV rows. **Rotate planting rows 90°** fits the same number of planting lines across the array, with breaks at the PV support lines.
2. In **Site & day**, enter the latitude, longitude, date, and UTC offset for that date. Longitude is positive east. For example, Tucson uses UTC−7 year-round. The timeline covers the first through last above-horizon minute on that local date.
3. Switch between **3D**, **Plan**, and **Profile**. Drag to orbit, right-drag to pan, and scroll or pinch to zoom. The reset button fits the array to the selected preset. Scrub the timeline or select **Play day**.
4. For a transparent overlay, check **Transparent background** beside **Export GIF**. The grid, ground color, and caption background disappear from the GIF. The hardware, crops, moving shadows, and timestamp remain visible. Select **Export GIF**, then choose the simulated time between frames, output width, and playback frame rate. Frames render at the selected width (up to 3840 px), independently of the preview size. Each frame keeps its original colors when they fit in a GIF palette, or uses up to 256 representative colors. The looping animation uses the current camera and includes the local date, time, UTC offset, and coordinates. Near-horizon shadows can extend outside the current view.

## Publish on GitHub Pages

1. Create an empty GitHub repository and push this project's files, including the lockfile and `.github/workflows/pages.yml`, to its `main` branch.
2. In the repository, open **Settings → Pages → Build and deployment** and select **GitHub Actions**.
3. Under **Actions → Verify and deploy GitHub Pages**, run the workflow on `main` or push a change. The build job installs the locked dependencies, tests the model, and creates the static bundle. A successful deployment provides the published URL in the **github-pages** environment.

The production build uses relative asset paths and works under a repository subdirectory. Hosting requires no API keys, backend, or external asset service.

## Model and attribution

Solar direction uses the experiment designer's NOAA fractional-year approximation and a geometric horizon. Modules, posts, and tubes project along that direction onto flat ground. Tracking poses update at each simulated time. Single-axis and vertical rows run north–south. Group aisles add spacing between groups, and checkerboard pergolas offset alternating rows by half a module pitch. Clearance checks increase axis height, row pitch, or table gap where needed.

Crop models depict representative mature plants with fixed heights and within-row spacing in metres. The models use a bush tomato, bush zucchini, potato foliage, a lettuce rosette, and tasseling sweet corn. Plant spacing is informed by [University of Minnesota Extension’s vegetable field planning guide](https://extension.umn.edu/vegetable-growing-guides-farmers/crop-and-field-planning-tools-vegetable-farmers).

Bifacial gap width, cell count, perimeter, and laminate transmission determine area-averaged broadband and PAR transmission. The drawing uses broadband transmission to lighten the module shadow. Overlapping silhouettes display the darkest caster. Ground shade represents geometric coverage. The simulator does not calculate weather-dependent irradiance, diffuse light, crop response, or electrical yield.

Solar position and module optics are adapted from the [Agrivoltaic Experiment Designer](https://github.com/saltysaguaro/agrivoltaic-experiment-designer/tree/9bf71de). The same project's geometry and tracker conventions inform the simulator. Its license is included in [DESIGNER-LICENSE](DESIGNER-LICENSE). The related [agrivoltaic_bf](https://github.com/saltysaguaro/agrivoltaic_bf) project provides the full irradiance-modeling workflow. Three.js and gifenc carry their respective dependency licenses.
