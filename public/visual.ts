"use strict"

const LIGHT_COLOR_SCALE = ["#FFC300", "#FF5733", "#C70039", "#900C3F", "#581845"];
const WEIGHT_SCALE = [2, 2.5, 3, 3.5, 4];


function getLineColor(count: number, sortedUnqiueCounts) {
    var color;

    if (sortedUnqiueCounts.length <= WEIGHT_SCALE.length) {
        color = LIGHT_COLOR_SCALE[sortedUnqiueCounts.indexOf(count)];
    }
    else {
        color = LIGHT_COLOR_SCALE[Math.floor(sortedUnqiueCounts.indexOf(count) / (sortedUnqiueCounts.length / LIGHT_COLOR_SCALE.length))];
    }

    if (!color) {
        return LIGHT_COLOR_SCALE[0];
    }
    return color;
}

function getLineWeight(count: number, sortedUnqiueCounts) {
    var weight;

    if (sortedUnqiueCounts.length <= WEIGHT_SCALE.length) {
        weight = WEIGHT_SCALE[sortedUnqiueCounts.indexOf(count)];
    }
    else {
        weight = WEIGHT_SCALE[Math.floor(sortedUnqiueCounts.indexOf(count) / (sortedUnqiueCounts.length / WEIGHT_SCALE.length))];
    }

    if (!weight) {
        return WEIGHT_SCALE[0];
    }
    return weight;
}



function getLineStyle(count: number, uniqueCounts) {
    return {
        color: getLineColor(count, uniqueCounts),
        weight: getLineWeight(count, uniqueCounts),
        myCount: count
    }
}

module powerbi.extensibility.visual {
    export class Visual implements IVisual {
        private host: IVisualHost;
        private target: HTMLElement;
        private settings: VisualSettings;
        private map: L.Map;
        private basemapStyle: string;
        private basemap: L.TileLayer;
        private routeLayer: L.FeatureGroup;
        private legend: L.Control;
        private info_legend: L.Control;
        private noData: L.Control;
        private myLines = [];
        private debug_html;

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.target = options.element;
            this.target.style.width = "100%";
            this.target.style.height = "100%";

            this.map = L.map(this.target, {
                attributionControl: false,
                maxZoom: 14
            }).fitBounds([[-10, 110], [-44, 154]]);

            this.routeLayer = L.featureGroup().addTo(this.map);

            this.legend = new L.Control({ position: 'bottomright' });
            this.legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'custom-control');
                div.style.padding = "8px";
                div.style.background = "rgba(50,50,50,0.8)";
                div.style.boxShadow = "0 0 6px rgba(0,0,0,0.3)";
                div.style.borderRadius = "5px";
                div.style.color = "#ddd";
                return div;
            };
            this.legend.addTo(this.map);

            this.info_legend = new L.Control({ position: 'bottomleft' });
            this.info_legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'custom-control');
                div.style.padding = "8px";
                div.style.background = "rgba(12,12,12,0.8)";
                div.style.boxShadow = "0 0 6px rgba(0,0,0,0.3)";
                div.style.borderRadius = "5px";
                div.style.color = "#ddd";
                return div;
            };
            this.info_legend.addTo(this.map);


            this.noData = new L.Control({ position: 'topright' });
            this.noData.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'custom-control');

                div.innerHTML = "No data";
                return div;
            };
            this.noData.addTo(this.map);
        }

        public update(options: VisualUpdateOptions) {
            this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
            if (!options || !options.dataViews || !options.dataViews[0]) {
                return;
            }

            var table = options.dataViews[0].table;

            // Change basemap if different to existing basemap
            if (this.basemapStyle !== this.settings.basemap.style) {
                if (this.basemap) {
                    this.map.removeLayer(this.basemap);
                }
                this.basemap = L.tileLayer("https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiYXZpbm1hdGhldyIsImEiOiJjaXpkYnA4Z2UwbXRzMnFvZTh5Nmh6amhxIn0.TCnwoGAgmQCbzz8n6fLRRQ", {
                    maxZoom: 18,
                    id: this.settings.basemap.style
                }).addTo(this.map);
                this.basemapStyle = this.settings.basemap.style;
            }

            const $noData = this.noData.getContainer();
            const $legend = this.legend.getContainer();
            const $info_legend = this.info_legend.getContainer();

            $noData.style.display = "none";
            $legend.style.display = "block";
            $info_legend.style.display = "block";

            console.log('Update called');



            // Remove any previous road layers if new set of data
            if (options.operationKind == VisualDataChangeOperationKind.Create) {
                console.log('First call');
                this.routeLayer.clearLayers();
                this.myLines.length = 0;

                // If no data, show info message and hide legend
                if (!table.rows.length) {
                    $noData.style.display = "block";
                    $legend.style.display = "none";
                    this.map.fitBounds([[-10, 110], [-44, 154]]); // Show Australia
                    return;
                }

            } else {
                console.log('Subsequent call');
            }

            const self = this;
            let readLines = 0;
            let errorLines = 0;
            options.dataViews[0].table.rows.forEach(row => {
                try {
                    const id = <string>row[0];
                    const geom = <string>row[1];
                    if (!id || !geom) {
                        return;
                    }
                    const coords = geom.split(",");
                    const line = coords.map(coord => {
                        const part = coord.split(" ");
                        return L.latLng(+part[1], +part[0]);
                    });
                    const count = <number>row[2];

                    this.myLines.push({ line: line, count: count, id: id })
                    readLines += 1;
                } catch (e) {
                    errorLines += 1;
                    // Ignore routes with errors
                    console.log(e);
                }

            });
            console.log('Lines read: ' + options.dataViews[0].table.rows.length);
            console.log('Correct lines: ' + readLines);
            console.log('Error lines: ' + errorLines);


            if (!options.dataViews[0].metadata.segment) {
                console.log('No more segments');
                // Render higher counts on top of lower counts
                this.myLines.sort((a, b) => a.count - b.count);

                // Find unique counts
                var sortedUnqiueCounts = [];
                this.myLines.forEach(aLine => {
                    if (sortedUnqiueCounts.indexOf(aLine.count) === -1) {
                        sortedUnqiueCounts.push(aLine.count);
                    }
                });

                var totalLines = 0;
                this.myLines.forEach(aLine => {
                    L.polyline(aLine.line, getLineStyle(aLine.count, sortedUnqiueCounts))
                        .bindPopup(`<dl><dt>Id</dt><dd>${aLine.id}</dd><dt>Count</dt><dd>${aLine.count}</dd></dl>`)
                        .addTo(this.routeLayer);
                    totalLines = totalLines + 1;
                });
                this.info_legend.getContainer().innerHTML = '<div>Total segments rendered: ' + this.myLines.length + ' Done!</div>';

                // Update legend
                let html = '<table class="legend"><tbody>';



                //The abstract problem here is to distrbute x unique, sorted items; amongst y ordered buckets.
                //Items being counts/volumes of segments; and buckets being distinct colors being used for rendering.
                var totalBuckets = LIGHT_COLOR_SCALE.length;
                var remainingBuckets = totalBuckets;
                var totalItems = sortedUnqiueCounts.length;
                var remainingItems = totalItems;
                var itemsPerBucket = Math.ceil(sortedUnqiueCounts.length / LIGHT_COLOR_SCALE.length);
                while ((remainingBuckets > 0) && (remainingItems > 0)) {
                    if (remainingItems > remainingBuckets) {
                        if (remainingItems >= itemsPerBucket) {
                            html += `<tr><td><i style="background:${getLineColor(sortedUnqiueCounts[totalItems - remainingItems], sortedUnqiueCounts)}"></i></td><td>` +
                                sortedUnqiueCounts[totalItems - remainingItems] + '&ndash;' + sortedUnqiueCounts[totalItems - remainingItems + itemsPerBucket - 1] + '</td></tr>';
                        }
                        else {
                            html += `<tr><td><i style="background:${getLineColor(sortedUnqiueCounts[totalItems - remainingItems], sortedUnqiueCounts)}"></i></td><td>` +
                                sortedUnqiueCounts[totalItems - remainingItems] + '&ndash;' + sortedUnqiueCounts[totalItems - 1] + '</td></tr>';
                        }
                        remainingItems = remainingItems - itemsPerBucket;
                        remainingBuckets = remainingBuckets - 1;
                    }
                    else {
                        html += `<tr><td><i style="background:${getLineColor(sortedUnqiueCounts[totalItems - remainingItems], sortedUnqiueCounts)}"></i></td><td>${sortedUnqiueCounts[totalItems - remainingItems]}</td></tr>`;
                        remainingItems = remainingItems - 1;
                        remainingBuckets = remainingBuckets - 1;
                    }
                }
                html += '<tr>Total: ' + totalLines + '</tr>';
                html += '</tbody></table>';

                this.legend.getContainer().innerHTML = html;


                // Zoom to data
                this.map.fitBounds(this.routeLayer.getBounds());
            } else {
                if (!this.host) {
                    console.error('<div>Host is missing</div>');
                }
                let request_accepted = this.host.fetchMoreData();
                if (!request_accepted) {
                    this.info_legend.getContainer().innerHTML = '<div>Power BI 100 MB memory constraint reached.</div>';
                    this.info_legend.getContainer().innerHTML += '<div>Total segments rendered: ' + this.myLines.length + '</div>';
                    this.info_legend.getContainer().innerHTML += '<div>Not all segments rendered. Apply filter to reduce data.</div>';
                } else {
                    console.log('Fetch called successfully');
                }
            }

        }

        private static parseSettings(dataView: DataView): VisualSettings {
            return VisualSettings.parse(dataView) as VisualSettings;
        }

        /**
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
         * objects and properties you want to expose to the users in the property pane.
         *
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}