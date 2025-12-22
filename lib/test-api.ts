export const testApiConnection = async () => {
  try {
    // Test basic connection (you might need to adjust this endpoint)
    const response = await fetch("https://driver-backend-ten.vercel.app/api/v1/"); // Update with your IP
    console.log("API connection test:", response.status);
    return response.ok;
  } catch (error) {
    console.error("API connection failed:", error);
    return false;
  }
};
