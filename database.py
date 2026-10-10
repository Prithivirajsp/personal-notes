import os
import urllib.parse

from sqlalchemy import create_engine 
from sqlalchemy.orm import sessionmaker, declarative_base

DBUSERNAME = os.getenv( "DBUSERNAME", "root" )

DBPASSWORD = os.getenv( "DBPASSWORD", "prithivi@2407" )

DBHOST = os.getenv( "DBHOST", "localhost" )

DBPORT = os.getenv( "DBPORT", "3306" )

DBNAME = os.getenv( "DBNAME", "pinboard_db" )


encodedpassword = urllib.parse.quote_plus(DBPASSWORD)

DATABASEURL = os.getenv( "DATABASEURL", ( f"mysql+pymysql://" f"{DBUSERNAME}:" f"{encodedpassword}@" f"{DBHOST}:" f"{DBPORT}/" f"{DBNAME}" ) )


engine = create_engine( DATABASEURL, pool_pre_ping=True, pool_recycle=3600, )



SessionLocal = sessionmaker( autocommit=False, autoflush=False, bind=engine, )


Base = declarative_base()


def get_db(): 
    db = SessionLocal()
    try:
         yield db 
    finally:
         db.close()