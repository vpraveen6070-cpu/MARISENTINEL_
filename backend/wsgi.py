"""
MARISENTINEL — WSGI Application Entry Point
Used for production WSGI servers like PythonAnywhere, Gunicorn, or uWSGI.
"""

import sys
import os

# Ensure backend directory is in python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app import app as application

if __name__ == "__main__":
    application.run()
