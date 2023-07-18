"use strict";
//keyword to look for to determine in a file to determine if this is a vehicle-folder
var keyword = "VehiclePawn";
var spacer = "______________________";
var $result = $("#result");
var countNew = 0;
var newDescs = [];
var countUpdated = 0;
var updatedDescs = [];
var globalZip = "";
$("#file").on("change", function (evt) {
    // remove content
    $result.html("");
    // be sure to show the results
    $("#result_block").removeClass("hidden").addClass("show");

    // Closure to capture the file information.
    function handleFile(f) {
        var $title = $("<h4>", {
            text: f.name
        });
        var $fileContent = $('<ul  class="row">');
        $result.append($title);
        $result.append($fileContent);

        var dateBefore = new Date();
        JSZip.loadAsync(f)                                   // 1) read the Blob
            .then(async function (zip) {
                globalZip = zip;
                var dateAfter = new Date();
                $title.append($("<span>", {
                    "class": "small",
                    text: " (loaded in " + (dateAfter - dateBefore) + "ms)"
                }));
                //Select Root Folder
                var ModFolder = zip.folder(zip.files[0]);
                //Look for Folders one Level down
                var inRootFolders = [];
                ModFolder.forEach(function (relativePath, zipEntry) {
                    if (zipEntry.dir == true) {
                        var isInRoot = relativePath.split("/").length - 2 == 1 ? true : false;
                        if (isInRoot) {
                            inRootFolders.push(zipEntry);
                        }
                    }
                });
                //Select only Folders with VehicleDefs
                var contentFolders = [];
                inRootFolders.forEach(function (currentFolder) {
                    var iFolder = zip.folder(currentFolder.name + "Defs/VehicleDefs/");
                    var DefCount = 0;
                    iFolder.forEach(function (currentFolder) {
                        DefCount++;
                    });
                    if (DefCount > 0) {
                        contentFolders.push(iFolder);
                    }
                });

                //Display error if there isn't atleast one VehicleDefs Folder
                if (contentFolders.length <= 0) {
                    $result.append($("<div>", {
                        "class": "alert alert-danger",
                        text: "No VehicleDefs found in zip"
                    }));
                }

                //Loop through VehicleDefs Folders looking for keyword
                var Vehicles = [];
                contentFolders.forEach(function (currentFolder) {
                    var iFolder = zip.folder(currentFolder.root);
                    iFolder.forEach(function (relativePath, zipEntry) {
                        var re = new RegExp(keyword, 'g');
                        var isVehicle = (zipEntry.name.match(re) || []).length;
                        if (isVehicle == 1) {
                            Vehicles.push(zipEntry.name.split(/\/(?=[^\/]+$)/)[0]);
                        }
                    });
                });

                //var vehicleData = await getVehicleData(zip, Vehicles)
                //console.log(vehicleData)

                getVehicleData(zip, Vehicles).then((vehicleData) => {
                    for (let vehicle of vehicleData) {
                        //console.log(vehicle)
                        //Display results
                        $fileContent.append(
                            `<li class="col-3">
                            ${vehicle.name}
                                <ul>
                                    <li>
                                    Crew Capacity: ${vehicle.slotCount}
                                    </li>
                                    <li>
                                    Cargo Capacity: ${vehicle.cargoCap} kg
                                    </li>
                                </ul>
                            </li>`
                        );

                    }
                    //maybe enable button
                    console.log(countUpdated)
                    let newDescsString = newDescs.join(", ")
                    let updatedDescsString = updatedDescs.join(", ")
                    $("#summary").html(`
                        Created ${countNew} (${newDescsString}) descriptions. <br><br> Updated ${countUpdated} (${updatedDescsString}) descriptions.
                    `);
                    if (countNew > 0 || countUpdated > 0) {
                        $("#download").prop('disabled', false);
                    }
                });
            }, function (e) {
                $result.append($("<div>", {
                    "class": "alert alert-danger",
                    text: "Error reading " + f.name + ": " + e.message
                }));
            });
    }

    var files = evt.target.files;
    for (var i = 0; i < files.length; i++) {
        handleFile(files[i]);
    }
});

async function readEntry(zipEntry) {
    return await zipEntry.async("string");
}


async function processVehicle(zip, zipEntry, VehicleName) {
    var VehicleData = [];
    //VehicleData[VehicleName] = [];
    const response = await zipEntry.async("string")
    //await zipEntry.async("string").then((response) => {
    let parser = new DOMParser(),
        xmlDoc = parser.parseFromString(response, 'text/xml');
    //Count Slots
    var slotCount = 0;
    var slots = xmlDoc.getElementsByTagName('slots');
    for (let slot of slots) {
        slotCount
            += parseInt(slot.innerHTML);
    }
    //Cargo Capacity
    var cargoCount = 0;
    var cargos = xmlDoc.getElementsByTagName('CargoCapacity');
    for (let cargo of cargos) {
        cargoCount
            += parseInt(cargo.innerHTML);
    }
    //Write Data into VehicleArray
    VehicleData["name"] = VehicleName;
    VehicleData["cargoCap"] = cargoCount;
    //console.log(cargoCount)
    VehicleData["slotCount"] = slotCount;
    var desc = xmlDoc.getElementsByTagName('description')[0].innerHTML;
    VehicleData["description"] = desc;
    VehicleData["path"] = zipEntry.name;


    var splitDesc = desc.split('\n\n' + spacer);
    var newDesc = splitDesc[0] +
        '\n\n' +
        spacer +
        '\n' +
        "Crew Capacity: " + slotCount +
        '\n' +
        "Cargo Capacity: " + cargoCount + "kg"
    '\n';

    if (splitDesc.length > 1) {
        console.log("description present")
        if (desc == newDesc){
            console.log("description same, skipping")
        } else {
            console.log("updated desc")
            updatedDescs.push(VehicleName)
            countUpdated++;
        }
    } else {
        console.log("description new")
        newDescs.push(VehicleName)
        countNew++;
    }

    //Process Data

    xmlDoc.getElementsByTagName('description')[0].innerHTML = newDesc;
    //console.log(xmlDoc.getElementsByTagName('description')[0].innerHTML)
    //write data back into file
    const serializer = new XMLSerializer();
    const xmlStr = serializer.serializeToString(xmlDoc);
    //Write into VehiclePawn
    zip.file(zipEntry.name, xmlStr)
    //Write into Buildable
    const buildable = await zip.file(zipEntry.name.replace('VehiclePawn', 'Buildable')).async("string")
    //console.log(buildable)
    let xmlDocB = parser.parseFromString(buildable, 'text/xml');
    xmlDocB.getElementsByTagName('description')[0].innerHTML = newDesc;
    const xmlStrB = serializer.serializeToString(xmlDocB);
    zip.file(zipEntry.name.replace('VehiclePawn', 'Buildable'), xmlStrB)
    
    //return data
    return VehicleData
}

function downloadZip() {
    //Download File
    globalZip.generateAsync({ type: "blob" })
        .then(function (blob) {
            saveAs(blob, "hello.zip");
        });
}

async function getVehicleData(zip, Vehicles) {
    var VehicleData = [];
    for (const currentFolder of Vehicles) {
        //console.log(currentFolder)
        var VehicleName = currentFolder.split(/\/(?=[^\/]+$)/)[1];
        //console.log(VehicleName)
        var iFolder = zip.folder(currentFolder + "/");
        var allFiles = [];
        iFolder.forEach(function (relativePath, zipEntry) {
            allFiles.push(zipEntry);
        });

        //console.log(allFiles)
        for (const zipEntry of allFiles) {
            //console.log(zipEntry.name)
            var re = new RegExp(keyword, 'g');
            var isVehicle = (zipEntry.name.match(re) || []).length;
            if (isVehicle == 1) {
                //Vehicles.push(zipEntry.name.split(/\/(?=[^\/]+$)/)[0]);
                VehicleData.push(processVehicle(zip, zipEntry, VehicleName));
            }

            /*
            //console.log(zipEntry)
            //var content = readEntry(zipEntry)
            const response = await zipEntry.async("string")
            //await zipEntry.async("string").then((response) => {
                let parser = new DOMParser(),
                    xmlDoc = parser.parseFromString(response, 'text/xml');
                //Count Slots
                var slotCount = 0;
                var slots = xmlDoc.getElementsByTagName('slots');
                for (let slot of slots) {
                    slotCount
                        += parseInt(slot.innerHTML);
                }
                //Cargo Capacity
                var cargoCount = 0;
                var cargos = xmlDoc.getElementsByTagName('CargoCapacity');
                for (let cargo of cargos) {
                    cargoCount
                        += parseInt(cargo.innerHTML);
                }
                //Write Data into VehicleArray
                VehicleData[VehicleName]["cargoCap"] = cargoCount;
                VehicleData[VehicleName]["slotCount"] = slotCount;
            //})
            //console.log(content)
                */
        };
    }
    /*
    Vehicles.forEach(function (currentFolder) {
        var VehicleName = currentFolder.split(/\/(?=[^\/]+$)/)[1];
        VehicleData[VehicleName] = [];
        var iFolder = zip.folder(currentFolder + "/");
        iFolder.forEach(async function (relativePath, zipEntry) {
            //var content = readEntry(zipEntry)
            var content = await zipEntry.async("string").then((response) => {
                let parser = new DOMParser(),
                    xmlDoc = parser.parseFromString(response, 'text/xml');
                //Count Slots
                var slotCount = 0;
                var slots = xmlDoc.getElementsByTagName('slots');
                for (let slot of slots) {
                    slotCount
                        += parseInt(slot.innerHTML);
                }
                //Cargo Capacity
                var cargoCount = 0;
                var cargos = xmlDoc.getElementsByTagName('CargoCapacity');
                for (let cargo of cargos) {
                    cargoCount
                        += parseInt(cargo.innerHTML);
                }
                //Write Data into VehicleArray
                VehicleData[VehicleName]["cargoCap"] = cargoCount;
                VehicleData[VehicleName]["slotCount"] = slotCount;
            })
            //console.log(content)

        });
    })
    */
    //await done;
    //console.log(await VehicleData)
    return await Promise.all(VehicleData);
}
