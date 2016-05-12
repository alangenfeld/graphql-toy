import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  parse,
  validate,
} from 'graphql';

import express from 'express';
import graphqlHTTP from 'express-graphql';
import level from 'level';
import crypto from 'crypto';

const db = level('./localdb');

let app = express();

const Root = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    whatAmI: {
      type: GraphQLString,
      resolve: () => 'A dummy schema for testing',
    },
    howMany: {
      type: GraphQLInt,
      resolve: () => 12
    },
  }),
});

const Schema = new GraphQLSchema({
  query: Root,
});

const fetchDoc = (id) => {
  return new Promise((resolve, reject) => {
    db.get(id, (err, val) => {
      if (err) {
        reject('Failed to load id: ' + id + '!');
        return;
      }
      resolve(parse(val));
      return;
    });
  });
};

const persistDoc = (id, query) => new Promise((resolve, reject) => {
  db.get(id, (err, val) => {
    if (!err && val) {
      resolve(id);
      console.log(id + ' already in DB.');
      return;
    }
    db.put(id, query, err => {
      if (!err) {
        console.log('Wrote ' + id + ' to DB');
        resolve(id);
        return;
      }
      reject({errors:['Failed to write to DB!']});
    });
  });
});

app.use('/graphql', graphqlHTTP({
  schema: Schema,
  graphiql: true,
  persistedDocumentResolver: fetchDoc
}));

app.get('/persist', (request, response) => {
  const query = request.query.query;
  let foo;
  response.set('Content-Type', 'application/json');

  graphqlHTTP.queryResolver(query, Schema).then(documentAST => {
    const id = crypto.createHash('md5').update(query).digest('hex');
    return persistDoc(id, query);
  },
  errorResponse => {
    response.status(400);
    response.json(errorResponse);
    return;
  }).then(
    id => {
      response.json({id: id});
      return;
    },
    err => {
      response.status(500);
      response.json(err);
      return;
    }
  )
});

app.listen('5000');
console.log('Now listening on 5000');
