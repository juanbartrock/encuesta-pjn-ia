import { withAuth } from "next-auth/middleware";

export default withAuth(
  // `withAuth` extiende tu objeto `Request` con el token del usuario.
  function middleware(req) {
    console.log('Middleware ejecutándose. Token:', req.nextauth.token);
    // Aquí podrías añadir lógica de redirección basada en roles si req.nextauth.token.isAdmin es true/false
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token, // Si hay un token, el usuario está autorizado
    },
    // Si pages no se especifica, redirige a la página de login por defecto de next-auth
    // o a la que hayas configurado en authOptions
    pages: {
        signIn: '/admin/login',
        // error: '/auth/error', // Opcional: página de error de autenticación
    }
  }
);

export const config = {
  matcher: [
    "/admin/:path*", // Proteger todas las sub-rutas de /admin
    // Puedes añadir más patrones aquí si es necesario
  ],
}; 