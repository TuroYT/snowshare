import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware() {
    // Middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/api/protected/:path*",
  ]
}
