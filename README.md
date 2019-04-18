
# JSONApi-Sequelize-Query
This library makes it easy to implement [JSONApi](https://jsonapi.org) formatted queries by converting them to [Sequelize ORM](https://doc.sequelize.js.com) formatted query objects.

Many of the concepts regarding the JSONApi specification and JSONApi-formatted queries can be found on the [JSONApi website](https://jsonapi.org).

If you are wanting a fully-functioning JSONApi server that will automatically create CRUD endpoints for you and that works with [Sequelize ORM](https://doc.sequelize.js.com), 
checkout our [JSONApi Server](https://github.com/becauseinterwebs/json-api-server).

## Installing

    npm install git@github.com:becauseinterwebs/jsonapi-sequelize-query.git

## Dot Notation
This library supports dot notation for filtering and including objects as well as for specifying the fields to be returned. For example:

    http://someurl.com/resource?filter[resource.name][eq]=Test&include=resource2,resource2.resource3&fields[resource2]=id,name

In the above example, the main resource object (represented here by **resource**) is filtering on the name and including a related object, **resource2**.
It is ALSO including a related object of **resource2** named **resource3** using dot notation.  Finally, only the fields **id** and **name** should be returned 
for the **resource2** object while all fields for the main **resource** object will be returned.

## Including Related Resources
You can include related resources by using the **include** keyword. For example:

    http://someurl.com/resource?include=resource2

To include multiple related resources, use a comma-delimited list

    http://someurl.com/resource?include=resource2,resource3,resource4

### Required and Optional Related Objects
By default, the **include** parameter means the object should be required, which means that any resource objects that do NOT have that related object will not be returned.

If you want the main resource returned regardless of whether the related resource exists or not, you can add an **asterisk** to the related object to denote that is not required 
but should be returned if it exists:

    http://someurl.com/resource?include=*resource2

## Filtering
The [JSONApi](http://jsonapi.org) v1 specification does not (at the time of this writing) have a formalized specification for implementing filters other than using the keyword 
**filter**, so a commonly used format has been adopted for this implementation. For example:

    https://someurl.com/resource?filter[resource.name][eq]=Test

will tell the engine to return a formatted query object that will tell the Sequelize ORM to only return resources that have a name column equaling 'Test' will be returned.

### Filtering Operators
The following filter operators can be used:

| Operator | Description | Example |
| --- | --- | --- |
| and | Match multiple filters | filter[resource.field][and]=1,2,3 |
| or | Match any or all of the filters | filter[resource.field][or]=1,2,3 |
| eq | Match exactly | filter[resource.field][eq]=Test |
| ne | Does not equal (exact match) | filter[resource.field][ne]=Test |
| in | Matches one of the filters provided in a list | filter[resource.field][in]=red,blue,green |
| notIn | Does not match any of the filters in a list | filter[resource.field][notIn]=red,blue,green | 
| lt | Field value is less that the filter value | filter[resource.field][lt]=10 |
| gt | Field value is greater than the filter value | filter[resource.field][gt]=10 |
| gte | Field value is greater than or equal to the filter value | filter[resource.field][gte]=10 |
| lte | Field value is less than or equal to the filter value | filter[resource.field][lte]=10 |
| between | Field value falls between a specified range, including the first and last values | filter[resource.field][between]=1,10 | 
| notBetween | Field value is not in the specified range | filter[resource.field][notBetween]=1,10 | 
| like | Field contains the filter value (case insensitive) | filter[resource.field][like]=test |
| notLike | Field does not contain the filter value | filter[resource.field][notLike]=test | 
| contains | Field contains the filter value (similar to like) | filter[resource.field][contains]=test | 
| startsWith | Field starts with the filter value | filter[resource.field][startsWith]=test | 
| endsWith | Field ends with the filter value | filter[resource.field][endsWith]=test |

### Operator Shortcuts
The following operator shortcuts can also be used:

| Shortcut | Equivalent | Example |
| --- | --- | --- |
| < | lt | filter[resource.field]=<*value*
| > | gt | filter[resource.field]=>*value*
| ~ | like | filter[resource.field]=~*value*
| ! | ne | filter[resource.field]=!*value*
| : | between | filter[resource.field]=:*1,10*
| / | startsWith | filter[resource.field]=/*value*
| \ | endsWith | filter[resource.field]=\\*value*

## Specifying Resource Fields
You can also specify the fields you want returned from a resource by using the **fields** keyword and a comma-delimited list of field names:

    http://someurl.com?users[fields]=id,name,address

This return all of the resources from a table named *users* with only the id, name and address fields.

## Filtering on Related Objects
You can also use the filters on related objects.  For example, if we have a **users** table that has related **address** objects, and those **address** objects 
have related **phonenumber** objects:

    http://someurl.com/users?include[address]&filter[address.city][eq]=Dallas

Nested related objects can also be filtered (*like* is used here so that the match is case-insensitive):

    http://someurl.com/users?include=address,address.phonenumber&filter[address.city][like]=Dallas&filter[address.phonenumber.phone][startsWith]=972

Or using filter shortcuts:

    http://someurl.com/users?include=address,address.phonenumber&filter[address.city]=~Dallas&filter[address.phonenumber.phone]=/972
