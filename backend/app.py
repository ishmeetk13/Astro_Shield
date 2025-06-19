from flask import Flask

app = Flask(_name_)

@app.route('/')
def home():
    return "AstroShield backend is running!"

if _name_ == "_main_":
    app.run(debug=True)
