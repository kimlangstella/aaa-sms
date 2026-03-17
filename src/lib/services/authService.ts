import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { userService } from "@/services/userService";

export const authService = {
    async signUp(email: string, password: string, name: string) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Create user profile in Firestore
            await userService.createProfile(user.uid, email, name);

            return user;
        } catch (error) {
            console.error("Error signing up:", error);
            throw error;
        }
    }
};
