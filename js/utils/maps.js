// =====================================================
// GOOGLE MAPS UTILITIES
// =====================================================

import { DEFAULT_LAT, DEFAULT_LNG, DEFAULT_ADDRESS } from '../config/constants.js';
import { showToast } from '../ui/toast.js';

// Map state
let map = null;
let marker = null;
let geocoder = null;
let mapInitialized = false;
let mapInitializing = false;
let selectedLat = DEFAULT_LAT;
let selectedLng = DEFAULT_LNG;
let selectedAddress = DEFAULT_ADDRESS;
let locationPickerMode = 'edit'; // 'edit' or 'create'

/**
 * Initializes Google Maps
 * @returns {Promise<void>}
 */
export async function initMap() {
    if (mapInitialized) return;
    if (mapInitializing) {
        // Wait for initialization to complete
        while (mapInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return;
    }

    mapInitializing = true;

    try {
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

        map = new Map(document.getElementById('map'), {
            center: { lat: selectedLat, lng: selectedLng },
            zoom: 14,
            mapId: 'f27c0aadac960951ff249d2f',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
        });

        marker = new AdvancedMarkerElement({
            map,
            position: { lat: selectedLat, lng: selectedLng },
            gmpDraggable: true,
        });

        geocoder = new google.maps.Geocoder();

        // Listen for map clicks
        map.addListener('click', (e) => {
            placeMarkerAndPanTo(e.latLng, map);
        });

        // Listen for marker drag end
        marker.addListener('dragend', () => {
            geocodeLatLng(marker.position);
        });

        mapInitialized = true;
    } catch (error) {
        console.error('Error initializing map:', error);
        showToast("Eroare la încărcarea hărții", "error");
    } finally {
        mapInitializing = false;
    }
}

/**
 * Places marker at location and pans map
 * @param {google.maps.LatLng} latLng - Location coordinates
 * @param {google.maps.Map} mapInstance - Map instance
 */
function placeMarkerAndPanTo(latLng, mapInstance) {
    marker.position = latLng;
    mapInstance.panTo(latLng);
    geocodeLatLng(latLng);
}

/**
 * Converts coordinates to address
 * @param {google.maps.LatLng} latlng - Location coordinates
 */
function geocodeLatLng(latlng) {
    geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK') {
            if (results[0]) {
                selectedAddress = results[0].formatted_address;
                selectedLat = latlng.lat();
                selectedLng = latlng.lng();
                const displayElement = document.getElementById('selected-location-display');
                if (displayElement) {
                    displayElement.value = selectedAddress;
                }
            } else {
                showToast('Nu s-au găsit rezultate', 'error');
            }
        } else {
            showToast('Eroare la geocodare: ' + status, 'error');
        }
    });
}

/**
 * Converts address to coordinates
 * @param {string} address - Address to geocode
 */
export function geocodeAddress(address) {
    if (!geocoder) return;

    geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK') {
            if (results[0]) {
                const latLng = results[0].geometry.location;
                placeMarkerAndPanTo(latLng, map);
                selectedAddress = results[0].formatted_address;
                selectedLat = latLng.lat();
                selectedLng = latLng.lng();
                const displayElement = document.getElementById('selected-location-display');
                if (displayElement) {
                    displayElement.value = selectedAddress;
                }
            } else {
                showToast('Adresa nu a fost găsită', 'error');
            }
        } else {
            showToast('Eroare la geocodare: ' + status, 'error');
        }
    });
}

/**
 * Opens location picker for profile edit
 * @param {object} currentLocation - Current location object {address, lat, lng}
 */
export async function openLocationPickerForEdit(currentLocation) {
    locationPickerMode = 'edit';
    const currentLoc = currentLocation || {
        address: DEFAULT_ADDRESS,
        lat: DEFAULT_LAT,
        lng: DEFAULT_LNG
    };

    await initMap();

    // Ensure map is initialized and ready before trying to set center/marker
    google.maps.event.addListenerOnce(map, 'idle', () => {
        geocodeAddress(currentLoc.address);
    });
}

/**
 * Opens location picker for creating post
 * @param {string} currentAddress - Current address value
 */
export async function openLocationPickerForCreate(currentAddress) {
    locationPickerMode = 'create';

    await initMap();

    google.maps.event.addListenerOnce(map, 'idle', () => {
        if (currentAddress) {
            geocodeAddress(currentAddress);
        } else {
            geocodeAddress(DEFAULT_ADDRESS);
        }
    });
}

/**
 * Gets selected location
 * @returns {{address: string, lat: number, lng: number}}
 */
export function getSelectedLocation() {
    return {
        address: selectedAddress,
        lat: selectedLat,
        lng: selectedLng
    };
}

/**
 * Sets selected location
 * @param {string} address - Address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 */
export function setSelectedLocation(address, lat, lng) {
    selectedAddress = address;
    selectedLat = lat;
    selectedLng = lng;
}

/**
 * Gets current picker mode
 * @returns {string} 'edit' or 'create'
 */
export function getLocationPickerMode() {
    return locationPickerMode;
}

/**
 * Initializes location search input
 */
export function initLocationSearch() {
    const locationSearch = document.getElementById('location-search');

    if (locationSearch) {
        let searchTimeout;

        locationSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                const searchQuery = e.target.value.trim();

                if (searchQuery.length > 2) {
                    geocodeAddress(searchQuery);
                }
            }, 500);
        });

        locationSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchQuery = e.target.value.trim();

                if (searchQuery) {
                    geocodeAddress(searchQuery);
                }
            }
        });
    }
}
