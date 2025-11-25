// =====================================================
// GENERIC API MODULE - Firestore Operations Wrapper
// =====================================================

import {
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    increment
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCollectionRef, getDocPath } from '../config/firebase-init.js';

// Re-export Firestore utilities for convenience
export {
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    increment
};

/**
 * Creates a new document in a collection
 * @param {string} collectionName - Collection name
 * @param {object} data - Document data
 * @returns {Promise<string>} Document ID
 */
export async function createDocument(collectionName, data) {
    const colRef = getCollectionRef(collectionName);
    const docRef = await addDoc(colRef, {
        ...data,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Sets a document (creates or overwrites)
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {object} data - Document data
 * @returns {Promise<void>}
 */
export async function setDocument(collectionName, docId, data) {
    const docRef = getDocPath(collectionName, docId);
    await setDoc(docRef, {
        ...data,
        createdAt: serverTimestamp()
    });
}

/**
 * Gets a single document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<{id: string, exists: boolean, data: object|null}>}
 */
export async function getDocument(collectionName, docId) {
    const docRef = getDocPath(collectionName, docId);
    const docSnap = await getDoc(docRef);
    return {
        id: docSnap.id,
        exists: docSnap.exists(),
        data: docSnap.exists() ? docSnap.data() : null
    };
}

/**
 * Gets all documents from a collection
 * @param {string} collectionName - Collection name
 * @param {object} queryConstraints - Firestore query constraints
 * @returns {Promise<Array>} Array of documents
 */
export async function getDocuments(collectionName, ...queryConstraints) {
    const colRef = getCollectionRef(collectionName);
    const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Updates a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {object} data - Data to update
 * @returns {Promise<void>}
 */
export async function updateDocument(collectionName, docId, data) {
    const docRef = getDocPath(collectionName, docId);
    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

/**
 * Deletes a document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<void>}
 */
export async function deleteDocument(collectionName, docId) {
    const docRef = getDocPath(collectionName, docId);
    await deleteDoc(docRef);
}

/**
 * Subscribes to real-time updates for a collection
 * @param {string} collectionName - Collection name
 * @param {Function} callback - Callback function receiving documents array
 * @param {object} queryConstraints - Firestore query constraints
 * @returns {Function} Unsubscribe function
 */
export function subscribeToCollection(collectionName, callback, ...queryConstraints) {
    const colRef = getCollectionRef(collectionName);
    const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;

    return onSnapshot(q, (snapshot) => {
        const documents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(documents, snapshot);
    });
}

/**
 * Subscribes to real-time updates for a single document
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {Function} callback - Callback function receiving document data
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDocument(collectionName, docId, callback) {
    const docRef = getDocPath(collectionName, docId);

    return onSnapshot(docRef, (docSnap) => {
        callback({
            id: docSnap.id,
            exists: docSnap.exists(),
            data: docSnap.exists() ? docSnap.data() : null
        });
    });
}

/**
 * Adds value to array field
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {string} field - Field name
 * @param {*} value - Value to add
 * @returns {Promise<void>}
 */
export async function addToArray(collectionName, docId, field, value) {
    const docRef = getDocPath(collectionName, docId);
    await updateDoc(docRef, {
        [field]: arrayUnion(value)
    });
}

/**
 * Removes value from array field
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {string} field - Field name
 * @param {*} value - Value to remove
 * @returns {Promise<void>}
 */
export async function removeFromArray(collectionName, docId, field, value) {
    const docRef = getDocPath(collectionName, docId);
    await updateDoc(docRef, {
        [field]: arrayRemove(value)
    });
}

/**
 * Increments a numeric field
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {string} field - Field name
 * @param {number} value - Value to increment by (default: 1)
 * @returns {Promise<void>}
 */
export async function incrementField(collectionName, docId, field, value = 1) {
    const docRef = getDocPath(collectionName, docId);
    await updateDoc(docRef, {
        [field]: increment(value)
    });
}

/**
 * Batch gets multiple documents by IDs
 * @param {string} collectionName - Collection name
 * @param {Array<string>} docIds - Array of document IDs
 * @returns {Promise<Array>} Array of documents
 */
export async function getDocumentsByIds(collectionName, docIds) {
    if (!docIds || docIds.length === 0) return [];

    const promises = docIds.map(id => getDocument(collectionName, id));
    const results = await Promise.all(promises);
    return results.filter(doc => doc.exists).map(doc => ({ id: doc.id, ...doc.data }));
}

/**
 * Checks if document exists
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<boolean>}
 */
export async function documentExists(collectionName, docId) {
    const docRef = getDocPath(collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
}

/**
 * Counts documents in a collection (with optional query)
 * @param {string} collectionName - Collection name
 * @param {object} queryConstraints - Firestore query constraints
 * @returns {Promise<number>} Document count
 */
export async function countDocuments(collectionName, ...queryConstraints) {
    const docs = await getDocuments(collectionName, ...queryConstraints);
    return docs.length;
}
