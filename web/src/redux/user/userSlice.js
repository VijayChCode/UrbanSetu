import { createSlice } from "@reduxjs/toolkit";

const initialState = {  // ✅ Fixed spelling
    currentUser: null,
    error: null,
    loading: false,
    isSigningOut: false
};

const userSlice = createSlice({
    name: 'user',
    initialState,  // ✅ Now correctly referenced
    reducers: {
        signInStart: (state) => {
            state.loading = true;
        },
        signInSuccess: (state, action) => {
            state.currentUser = action.payload;
            state.loading = false;
            state.error = null;
        },
        signInFailure: (state, action) => {
            state.error = action.payload;
            state.loading = false;
        },
        verifyAuthStart: (state) => {
            state.loading = true;
        },
        verifyAuthSuccess: (state, action) => {
            state.currentUser = action.payload;
            state.loading = false;
            state.error = null;
        },
        verifyAuthFailure: (state, action) => {
            state.currentUser = null;
            state.error = action.payload;
            state.loading = false;
        },
        updateUserStart: (state) => {
            state.loading = true
        },
        updateUserSuccess: (state, action) => {
            state.currentUser = action.payload;
            state.loading = false;
            state.error = null;
        },
        updateUserFailure: (state, action) => {
            state.error = action.payload
            state.loading = false
        },
        deleteUserStart: (state) => {
            state.loading = true
        },
        deleteUserSuccess: (state, action) => {
            state.currentUser = null;
            state.loading = false;
            state.error = null;
        },
        deleteUserFailure: (state, action) => {
            state.error = action.payload
            state.loading = false
        },
        signoutUserStart: (state) => {
            state.loading = true;
            state.isSigningOut = true;
        },
        signoutUserSuccess: (state, action) => {
            state.currentUser = null;
            state.loading = false;
            state.error = null;
            state.isSigningOut = false;
        },
        signoutUserFailure: (state, action) => {
            state.error = action.payload
            state.loading = false;
            state.isSigningOut = true; // Keep true to show error in modal
        },
        resetSignoutState: (state) => {
            state.isSigningOut = false;
            state.error = null;
            state.loading = false;
        }
    }
});

export const { 
    signInStart, signInSuccess, signInFailure, 
    verifyAuthStart, verifyAuthSuccess, verifyAuthFailure, 
    updateUserStart, updateUserSuccess, updateUserFailure, 
    deleteUserStart, deleteUserSuccess, deleteUserFailure, 
    signoutUserStart, signoutUserSuccess, signoutUserFailure,
    resetSignoutState
} = userSlice.actions;
export default userSlice.reducer;
