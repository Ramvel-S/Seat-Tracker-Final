from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from pydantic import BaseModel

app = FastAPI()

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (including OPTIONS)
    allow_headers=["*"],  # Allow all headers
)

# Database Connection
conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Codeath@123",
    database="seat_tracker",
    port=3306  # MySQL default port
)
cursor = conn.cursor()

# Request Model
class QRRequest(BaseModel):
    qr_data: str

@app.post("/check-seat")
def check_seat(request: QRRequest):
    qr_data = request.qr_data

    # Check if the QR code exists and if it's not occupied (occupied = 0)
    cursor.execute("SELECT occupied FROM qr_data WHERE qr_code = %s", (qr_data,))
    seat = cursor.fetchone()

    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found")

    if seat[0] == 1:
        raise HTTPException(status_code=400, detail="Seat already occupied")

    # If seat is not occupied, update it to 1 (occupied)
    cursor.execute("UPDATE qr_data SET occupied = 1 WHERE qr_code = %s", (qr_data,))
    conn.commit()  # Save changes to the database

    return {"message": "Seat status updated to occupied", "occupied": True}

# Run the server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)