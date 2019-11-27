import { SERVICE_TYPES, CRS_SERVICE_TYPES } from '../UbpCrsAdapter'

const CONFIG = {
    serviceCodeRegEx: {
        // USA96A4/MIA0H-TPA
        old: /^([A-Z]*[0-9]*)([A-Z]*[0-9]*)\/(.*)-(.*)$/,
        // MIA03SFO0HMBMN81
        sipp: /^(.{5})(.{5})(.{4})(.{2})$/,
        // MUC10-BER
        // SFO
        locationsOnly: /^([A-Z0-9]{3,5})-?([A-Z0-9]{3,5})?$/,
    },
}

class VehicleHelper {
    constructor(config) {
        this.config = config
    }

    isServiceMarked(service) {
        if (service.marker) {
            return true
        }

        return !service.code || !!service.code.match(CONFIG.serviceCodeRegEx.locationsOnly)
    }

    splitServiceCode(code) {
        if (!code) return {}

        return this.splitSippServiceCode(code)
            || this.splitOldServiceCode(code)
            || this.splitLocationsOnlyServiceCode(code)
            || {}
    };

    splitOldServiceCode(code) {
        const indexRentalCode = 1
        const indexVehicleTypeCode = 2
        const indexPickUpLocation = 3
        const indexDropOffLocation = 4

        let codeParts = code.match(CONFIG.serviceCodeRegEx.old)

        return codeParts ? {
            renterCode: codeParts[indexRentalCode],
            vehicleCode: codeParts[indexVehicleTypeCode],
            pickUpLocation: codeParts[indexPickUpLocation],
            dropOffLocation: codeParts[indexDropOffLocation],
        } : void 0
    }

    splitLocationsOnlyServiceCode(code) {
        const indexPickUpLocation = 1
        const indexDropOffLocation = 2

        let codeParts = code.match(CONFIG.serviceCodeRegEx.locationsOnly)

        return codeParts ? {
            pickUpLocation: codeParts[indexPickUpLocation],
            dropOffLocation: codeParts[indexDropOffLocation],
        } : void 0
    }

    splitSippServiceCode(code) {
        if (code.length !== 16) {
            return
        }

        const indexPickUpLocation = 1
        const indexDropOffLocation = 2
        const indexSipp = 3
        const indexLastPartOfRenterCode = 4

        let codeParts = code.match(CONFIG.serviceCodeRegEx.sipp)

        return codeParts ? {
            pickUpLocation: codeParts[indexPickUpLocation],
            dropOffLocation: codeParts[indexDropOffLocation],
            sipp: codeParts[indexSipp],
        } : void 0
    }

    mergeCarAndDropOffServiceLines(services) {
        return services.reduce((mergedServices, line) => {
            const lastMergedLine = mergedServices[mergedServices.length - 1] || {}
            const lineIsValidDropOffTime = line.type === CRS_SERVICE_TYPES.carDropOffTime && line.accommodation
            const lastLineIsValidCar = lastMergedLine.type === SERVICE_TYPES.car && !lastMergedLine.dropOffTime

            if (lineIsValidDropOffTime && lastLineIsValidCar) {
                lastMergedLine.dropOffTime = line.accommodation
            } else {
                mergedServices.push(line)
            }

            return mergedServices
        }, [])
    }

    createServiceCode(adapterService = {}) {
        if (adapterService.sipp) {
            return [
                adapterService.pickUpLocation,
                adapterService.dropOffLocation,
                adapterService.sipp,
                adapterService.renterCode.slice(-2),
            ].join('') || void 0
        }

        return [
            adapterService.renterCode,
            adapterService.vehicleCode,
            '/',
            adapterService.pickUpLocation,
            '-',
            adapterService.dropOffLocation,
        ].join('').replace(/^\/-|\/-$/, '') || void 0
    }
}

export default VehicleHelper
