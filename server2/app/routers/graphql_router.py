from fastapi import APIRouter
from strawberry.fastapi import GraphQLRouter
from app.graphql.schema import schema

router = GraphQLRouter(schema)
