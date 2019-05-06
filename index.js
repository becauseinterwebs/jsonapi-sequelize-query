/*
 * sequelize-jsonapi-query
 * Version: 1.0.0
 * Author: Brent Williams <brent.williams@mirumagency.com>
 * 
 * Library to parse URL query strings into JSON query objects 
 * for Sequelize ORM
 * 
 */

'use strict';

const Sequelize = require('sequelize');

let validOperators = [
    'and',
    'or',
    'eq',
    'ne',
    'in',
    'notIn', 
    'lt',
    'gt',
    'gte',
    'lte',
    'between', 
    'notBetween', 
    'like', 
    'notLike', 
    'contains', 
    'startsWith', 
    'endsWith'
  ];
  
let validChars = { 
    '<'  : 'lt', 
    '>'  : 'gt', 
    '~'  : 'like', 
    '!'  : 'ne',
    ':'  : 'between',
    '/'  : 'startsWith',
    '\\' : 'endsWith'
  };
    
class SequelizeJsonApiQuery {

  constructor(options) {
    this._resources = !!options.resources && Array.isArray(options.resources) ? options.resources : [];
    this._remap = !!options.remap ? options.remap : {};
    this._validOperators = validOperators;
    this._validChars = validChars;
    this._filters = {};
    this._optionalToken = '*';
    this._defaultResource;
    this._query = {
      where : {}
    };
  }
  
  set resources(resources) {
    this._resources = resources;
  }
  
  get resources() {
    return this._resources;
  }
  
  remap(resource) {
    return this._remap.hasOwnProperty(resource) ? this._remap[resource] : resource;
  }
  
  extractFilters(req, resource) {
    
    let result;
    
    if (!this._filters.hasOwnProperty(resource)) {
      return result;
    }

    let isDefault = false;
    
    if (resource.indexOf('.') > -1) {
      let parts = resource.split('.');
      isDefault = (parts[0].toLowerCase() === this._defaultResource.toLowerCase());
    } else {  
      isDefault = (resource.toLowerCase() === this._defaultResource.toLowerCase());
    }
    
    let that = this;
    
    result = {};

    let filters = this._filters;
      
    // grab all the filters for this resource
    let filterFields;
    if (typeof filters[resource] === 'object' && !Array.isArray(filters[resource])) {
      filterFields = Object.keys(filters[resource]);
    } else if (Array.isArray(filters[resource])) {
      filterFields = filters[resource];
    } else {
      filterFields = [filters[resource]];
    }

    filterFields.map(filterField => {

      // special case processing for main resource
      //if (filters[resource][filter].)
      let filterObj = filters[resource][filterField];

      // ** SHORTHAND SYNTAX CHECK
      // check if the filter is a standard filter-formatted object 
      // or if the shorthand syntax is being used, in which case 
      // it will need to be converted
      if (Array.isArray(filterObj)) {

        // This would be the result of shorthand syntax like:
        // filter[resource][id]=>1&filter[resource][id]=<10
        let obj = {};

        filterObj.map(val => {
          let c = val.substring(0,1);
          let k = 'eq';
          if (Object.keys(this._validChars).indexOf(c) > -1) {
            val = val.substring(1);
            k = this._validChars[c];
            obj[k] = val;
          }
        });

        filterObj = obj;

      } else if (typeof filterObj !== 'object') {

        if (typeof filterObj === 'string' && filterObj.indexOf(',') > -1) {
          filterObj = this.sanitizeFilter(filterObj, 'in');
        } else {
          // Check to see if the first character of the value 
          // is a shorthand comparison symbol. If not then 
          // just set the filter type to 'eq'
          // Ex. filter[resource]=2 (set to 'eq' : 2 )
          //     filter[resource]=>2 { set to 'gt' : 2 }
          filterObj = this.sanitizeFilter(filterObj, 'eq');
        }

      }

       let filterKeys = Object.keys(filterObj);

       if (filterKeys && filterKeys.length) {

           filterKeys.map(function(filter) {

               // flag to let us know
               let filterValues = '';

               if (Array.isArray(filterObj[filter])) {
                   let vals = filterObj[filter];
                   let newVals = [];
                   vals.map(function(v) {
                       if (v && v !== '') {
                           newVals.push(v);
                       }
                   });
                   if (newVals.length > 0) {
                       filterValues = newVals;
                   };
               } else {
                   switch (filter.toLowerCase()) {
                       case 'in':
                       case 'notin':
                       case 'between':
                       case 'notbetween':
                           filterValues = filterObj[filter].split(',');
                           break;
                       default:
                           filterValues = [filterObj[filter]];
                           break;
                   }
               }

               filterValues = (filterValues.length && filterValues.length > 0) ? filterValues : null;

               if (filterValues) {

                    let isOr = filter.substring(0,2).toLowerCase() === 'or';
                    if (isOr) {
                        filter = filter.substring(2);
                    }

                    // remap to correct casing
                    switch (filter) {
                      case 'notin':
                        filter = 'notIn';
                        break;
                      case 'notlike':
                        filter = 'notLike';
                      case 'startswith':
                        filter = 'startsWith';
                        break;
                      case 'endswith':
                        filter = 'endsWith';
                        break;
                      case 'notbetween':
                        filter = 'notBetween';
                        break;
                    }

                    filterValues.map(function(filterValue) {

                        if (filterValue === true || filterValue === 'true') {
                            filterValue = 1;
                        } else if (filterValue === false || filterValue === 'false') {
                            filterValue = 0;
                        } else if (filterValue.toLowerCase() === 'null') {
                            filterValue = null;
                        }

                        switch (filter) {
                            case 'contains':
                              filter = 'like';
                              filterValue = '%' + filterValue + '%';
                              break;
                            case 'like':
                            case 'notLike':
                                filterValue = '%' + filterValue + '%';
                                break;
                            case 'startsWith':
                                filterValue = filterValue + '%';
                                filter = 'like';
                                break;
                            case 'endsWith':
                                filterValue = '%' + filterValue;
                                filter = 'like';
                                break;
                        }

                        if (isOr) {

                            let keyField = filterField;

                            keyField = '$' + (isDefault ? `${that._defaultResource}.` : `${resource}.`)  + keyField + '$';
                            
                            if (!result.hasOwnProperty(Sequelize.Op.or)) {
                                result[Sequelize.Op.or] = [];
                            }
                            
                            switch (filter) {
                                case 'in':
                                case 'notIn':
                                case 'between':
                                case 'notBetween':  
                                    let idx = -1;
                                    for (let i = 0; i < result[Sequelize.Op.or].length; i++) {
                                        let orField = result[Sequelize.Op.or][i];
                                        let orFieldKeys = Object.keys(orField);
                                        if (orFieldKeys.indexOf(keyField) > -1) {
                                            idx = i;
                                            break;
                                        }
                                    }
                                    if (idx < 0) {
                                        let f = {
                                            [keyField] : {
                                                [Sequelize.Op[filter]] : [filterValue]
                                            }
                                        };
                                        result[Sequelize.Op.or].push(f);
                                    } else {
                                        result[Sequelize.Op.or][idx][keyField][Sequelize.Op[filter]].push(filterValue);
                                    }
                                    break;
                                default:
                                    let f = {
                                        [keyField] : {
                                            [Sequelize.Op[filter]] : filterValue
                                        }
                                    };
                                    result[Sequelize.Op.or].push(f);
                                    break;
                            }

                            //if (isDefault) {
                              //that._query.where = result;
                            //}
                            
                        } else {

                          if (!result.hasOwnProperty(filterField)) {
                            result[filterField] = {};
                          }
                          switch (filter) {
                              case 'in':
                              case 'notIn':
                              case 'between':
                              case 'notBetween':
                                  if (!result[filterField].hasOwnProperty(Sequelize.Op[filter])) {
                                      result[filterField][Sequelize.Op[filter]] = [];
                                  }
                                  result[filterField][Sequelize.Op[filter]].push(filterValue);
                                  break;
                              default:
                                  if (filterValue === null) {
                                      result[filterField] = null;
                                  } else {
                                      result[filterField][Sequelize.Op[filter]] = filterValue;
                                  }
                                  break;
                          }
                        } // end if isOr

                   }); // filterValues.map

               } // if filterValues

           }); // filterKeys.map

      } else { 
        let filterValue = filterObj;
        if (filterValue.toLowerCase() === 'null') {
          filterValue = null;
        }
        result[filterField][Sequelize.Op.eq] = filterValue;
      }

   });

   return result;
    
  };
  
  addInclude(req, resource, includes, children, path) {
    let found = false;
    let index;
    let count = 0;
    let required = true;
    // remove any 'optional' tokens from path
    if (!!path) {
      path = path.replace(/\*/gi, '');
    }
    if (resource.indexOf(this._optionalToken) === 0) {
      resource = resource.substring(1);
      required = false;
    }
    let result = [];
    includes.map(include => {
      if (include.association === resource) {
        found = true;
        index = count;
      } else {
        count++;
      }
    });
    if (!found) {
      result = {
        association: resource,
        required: required
      };
      if (children === true) {
        result.include = [];
      }
      if (!!path && !!req.query.fields && req.query.fields.hasOwnProperty(path)) {
        result.attributes = req.query.fields[path].split(',');
      }
      let filterPath = (!!path ? path : resource);
      if (!!filterPath) {
        let where = this.extractFilters(req, filterPath);
        if (!!where) {
          if (where.hasOwnProperty(Sequelize.Op.or)) {
            if (!this._query.where.hasOwnProperty(Sequelize.Op.or)) {
              this._query.where[Sequelize.Op.or] = [];
            }
            this._query.where[Sequelize.Op.or].push(where[Sequelize.Op.or]);
            delete where[Sequelize.Op.or];
          }
          result.where = where;
        }
      }
      includes.push(result);
    } else {
      result = includes[index];
      if (children === true && !result.hasOwnProperty('include')) {
        result.include = [];
      }
      if (!!path && !!req.query.fields && req.query.fields.hasOwnProperty(path)) {
        result.attributes = req.query.fields[path].split(',');
      }
      if (!!path) {
        let where = this.extractFilters(req, path);
        if (!!where) {
          if (where.hasOwnProperty(Sequelize.Op.or)) {
            if (!this._query.where.hasOwnProperty(Sequelize.Op.or)) {
              this._query.where[Sequelize.Op.or] = [];
            }
            this._query.where[Sequelize.Op.or].push(where[Sequelize.Op.or]);
            delete where[Sequelize.Op.or];
          }
          result.where = where;
        }
      }
      includes[index] = result;
    }
    return result;
  }
  
  extractIncludes(req, resource, includes, path) {
    
    if (!includes) {
      includes = [];
    }
      
    if (resource.indexOf('.') > -1) {

      let parts = resource.split('.');

      resource = parts[0];

      let include = this.addInclude(req, resource, includes, true);

      parts.shift();

      let related = parts.join('.');

      this.extractIncludes(req, related, include.include, path);

    } else {

      if (!path) {
        path = resource;
      }
      
      let include = this.addInclude(req, resource, includes, false, path);
      
    }
    
    return includes;
    
  }
  
  // Check if any filters are part of the request and make sure they are formatted 
  // correctly.  This function will reorganize and reformat filters as needed.
  prepareFilters(req) {
    this._filters = {};
    if (!req.query.filter) {
      return;
    }
    let that = this;
    Object.keys(req.query.filter).map(key => {
        let filterKey = key;
        key = that.remap(key);
        let resourceKey = (key === that._defaultResource) 
                            ? that._defaultResource 
                            : key.indexOf('.') > -1 
                              ? key 
                              : (!!that._resources && that._resources.indexOf(key) > -1)
                                ? key 
                                : that._defaultResource;
        let filterValue = req.query.filter[filterKey];
        if (resourceKey.indexOf('.') > -1) {
          let parts = resourceKey.split('.');
          key = parts.pop();
          resourceKey = parts.join('.');
        }
        
        if (!that._filters.hasOwnProperty(resourceKey)) {
          that._filters[resourceKey] = {};
        }
        
        switch (typeof filterValue) {
          case 'string':
            that._filters[resourceKey][key] = filterValue;
            break;
          case 'object':
            that._filters[resourceKey][key] = filterValue;
            break;
          default: 
            Object.keys(req.query.filter[filterKey]).map(id => {
              that._filters[resourceKey][id] = req.query.filter[filterKey][id];
            });
            break;
        }
        
    });
    
  }
  
  sanitizeFilter(input, defaultToken) {
    // check if the token starts with a shortcut character
    let c = input.substring(0,1);
    // by default a value with commas is checking that the
    // value is in a range or group...
    let k = defaultToken;  
    // if the token is a valid token then remove it from 
    // the input string and set the correct comparison token
    if (Object.keys(this._validChars).indexOf(c) > -1) {
      input = input.substring(1);
      k = this._validChars[c];
    }  
    let result = {};
    result[k] = input;
    return result;
  };
  
  getOrderBy(req, defaultResource) {
    defaultResource = this.remap(defaultResource);
    
    let orderBy = [];
    let source = !!req.query.sort 
                  ? req.query.sort
                  : (!!req.query.order 
                    ? req.query.order
                    : null);
    if (!source) {
      return orderBy;
    }     
    if (typeof source === 'string') {
      // sort came in as a string: sort=resource.field,resource.field
      source.split(',').map(field => {
        let dir = 'asc';
        if (field.indexOf('-') === 0) {
          dir = 'desc';
          field = field.substring(1);
        }
        let o = [];
        if (field.indexOf('.') > -1) {
          let parts = field.split('.');
          parts.map(part => {
            o.push(part);
          });
          o.push(dir);
        } else {
          o = [field,dir];
        }
        orderBy.push(o);
      });
    } else {
      // sort came in as resource[field]=asc/desc
      Object.keys(source).map(key => {
        if (key.indexOf('.') > -1) {
          let parts = key.split('.');
          let res = parts[0];
          let fld = parts[1];
          if (!source.hasOwnProperty(res)) {
            source[res] = {};
          }
          source[res][fld] = source[key];
          key = res;
        }
        let cols = Object.keys(source[key]);
        cols.map(col => {
          let o = [];
          if (key !== defaultResource) {
            o.push(key);
          }
          o.push(col);
          o.push(source[key][col]);
          orderBy.push(o);
        });
      });
    }
    return orderBy;
  }
  
  parse(req, resource) {
    
    this._defaultResource = resource;
    
    // clean-up and reorganize filter parameters
    this.prepareFilters(req);
    
    // Get the query conditions (the "where" clause) for the main resource.
    let where = this.extractFilters(req, resource);
    
    if (!!where) {
      this._query.where = where;
    }
    
    let includes;
    
    // Get any included (related) resources and their filters and fields
    if (!!req.query.include) {
      let temp = typeof req.query.include === 'string' 
                      ? req.query.include.split(',')
                        : req.query.include;
      // double check array...depending on the query string the array elements 
      // can have comma-delimited strings...
      let included = [];
      temp.map(include => {
        if (include.indexOf(',') > -1) {
           included = included.concat(include.split(','));
        } else {
          included.push(include);
        }
      });
      
      includes = [];
      let that = this;
      included.map(include => {
        // remove leading or trailing spaces
        include = include.trim();
        that.extractIncludes(req, include, includes, include);
      });
    }  
    
    if (!!includes && includes.length) {
      this._query.include = includes;
    }
    
    if (req.query.fields && req.query.fields[resource]) {
      this._query.attributes = req.query.fields[resource].split(',');
    }
    
    // process any order by clauses
    let orderBy = this.getOrderBy(req, resource);
    if (orderBy.length) {
      this._query.order = orderBy;
    }

    // see if there is a record limit
    if (!!req.query.limit) {
      try {
        let limit = parseInt(req.query.limit);
        this._query.limit = limit;
      } catch (err) {
        // do nothing 
      }
    }

    // see if there is a record offset
    if (!!req.query.offset) {
      try {
        let offset = parseInt(req.query.offset);
        this._query.offset = offset;
      } catch (err) {
        // do nothing 
      }
    }
      
    return this._query;
    
  }
  
  /**
   * Remaps AWS Lambda event data
   * @param {type} event
   * @param {type} resource
   * @returns {nm$_index.SequelizeJsonApiQuery._query}
   */
  parseAWS(event, resource) {

    let req = {
      query : {}
    };
    
    if (!!event.queryStringParameters) {
      Object.keys(event.queryStringParameters).map(key => {
        if (key.indexOf('fields') === 0) {
          let r = key.substring(7, key.length-1);
          if (!req.query.fields) {
            req.query.fields = {};
          }
          req.query.fields[r] = event.queryStringParameters[key]
        } else if (key.indexOf('filter') === 0) {
          let r = key.substring(7, key.length-1);
          if (!req.query.filter) {
            req.query.filter = {};
          }
          req.query.filter[r] = event.queryStringParameters[key]
        } else {  
          req.query[key] = event.queryStringParameters[key]
        }
      });
    }
    
    return this.parse(req, resource);
    
  }
  
}

module.exports = SequelizeJsonApiQuery;