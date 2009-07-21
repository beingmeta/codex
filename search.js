/* -*- Mode: Javascript; -*- */

var sbooks_search_id="$Id$";
var sbooks_search_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements the search component of a 
    Javascript/DHTML UI for reading large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.
   This file assumes that the sbooks.js file has already been loaded.

   This program comes with absolutely NO WARRANTY, including implied
   warranties of merchantability or fitness for any particular
   purpose.

    Use and redistribution (especially embedding in other
      CC licensed content) is permitted under the terms of the
      Creative Commons "Attribution-NonCommercial" license:

          http://creativecommons.org/licenses/by-nc/3.0/ 

    Other uses may be allowed based on prior agreement with
      beingmeta, inc.  Inquiries can be addressed to:

       licensing@beingmeta.com

   Enjoy!

*/


/* Tag setup */

var sbook_trace_tagging=false;

function sbookAddTag(elt,tag,prime,contextual,unique,kno)
{
  if (!(kno)) kno=knowlet;
  if ((typeof tag === "string") && (tag[0]==="\u00A7")) {}
  else if ((kno) && (typeof tag === "string"))
    tag=KnowDef(tag,kno);
  // Force a sortkey
  if (!(elt.sortkey))
    if (elt.id) elt.sortkey=elt.id;
    else if (elt.sortKey) elt.sortkey=elt.sortKey();
    else elt.sortkey=elt.toString();
  var dterm=((typeof tag === "string") ? (tag) : (tag.dterm));
  if (elt.hasOwnProperty('tags'))
    if (elt.tags.indexOf(dterm)<0) elt.tags.push(dterm);
    else return;
  else elt.tags=new Array(dterm);
  if (sbook_trace_tagging) 
    fdjtLog("Tagging %o#%s with %s/%o",elt,elt.id,dterm,tag);
  /* This is for tags which indicate sections */
  if ((typeof tag === "string") && (tag[0]==="\u00A7")) {
    fdjtAdd(sbook_index,tag,elt,(!(unique)));
    fdjtAdd(sbook_prime_index,tag,elt,(!(unique)));
    if (!(contextual))
      fdjtAdd(sbook_direct_index,tag,elt,(!(unique)));
    return;}
  /* knoIndexTag returns true if the value wasn't identified as a duplicate */
  knoIndexTag(sbook_index,tag,elt,kno_wgenls,(!(unique)));
  knoIndexTag(sbook_dterm_index,tag,elt,kno_wogenls,(!(unique)));
  if (prime)
    knoIndexTag(sbook_prime_index,tag,elt,kno_wogenls,(!(unique)));
  if (!(contextual))
    knoIndexTag(sbook_direct_index,tag,elt,kno_wogenls,(!(unique)));
}

function sbookHandleTagSpec(elt,tagspec)
{
  var tag_count=0;
  tagspec=fdjtUnEntify(tagspec);
  if (knowlet) {
    var tagentries=knowlet.segmentString(tagspec,';');
    tag_count=tag_count+tagentries.length;
    var j=0; while (j<tagentries.length) {
      var tagentry=tagentries[j++];
      if (tagentry==="") continue;
      var knowde=false; var prime=false; var auto=false;
      if (tagentry[0]==='*') {
	knowde=knowlet.handleSubjectEntry(tagentry.slice(1));
	prime=true;}
      else if (tagentry[0]==='~') {
	knowde=knowlet.handleSubjectEntry(tagentry.slice(1));
	auto=true;}
      else knowde=knowlet.handleSubjectEntry(tagentry);
      // fdjtTrace("adding tag %o to %s",knowde,elt.id);
      sbookAddTag(elt,knowde,prime);}}
  else {
    var entries=tagspec.split(';'); var prime=false; var auto=false;
    tag_count=tag_count+entries.length;
    var i=0; while (i<entries.length) {
      var j=0; var clauses=entries[i++].split('|');
      if (clauses[0][0]==='*') {
	prime=true; clauses[0]=clauses[0].slice(1);}
      else if (clauses[0][0]==='~') {
	auto=true; clauses[0]=clauses[0].slice(1);}
      while (j<clauses.length) {
	var clause=clauses[j++];
	if (clause==="") {}
	else if (clause.search(/\w/)===0)
	  /* Synonym */
	  sbookAddTag(elt,clause,false);
	else if (clause[0]==='^')
	  /* Genl */
	  sbookAddTag(elt,clause.slice(1),false);
	else {}}}}
  return tag_count;
}

function setupTags()
{
  var start=new Date();
  var elt_count=0; var tag_count=0;
  if (typeof knowletHTMLSetup != "undefined") {
    knowletHTMLSetup();
    fdjtLog("Set up default knowlet %s, initially %d dterms",
	    knowlet.name,knowlet.alldterms.length);}
  var tagged_elts=fdjtGetChildrenByAttrib(document.body,"TAGS");
  elt_count=elt_count+tagged_elts.length;
  var i=0; while (i<tagged_elts.length) {
    var elt=tagged_elts[i++];
    var tagspec=elt.getAttribute("TAGS");
    tag_count=tag_count+sbookHandleTagSpec(elt,tagspec);}
  tagged_elts=fdjtGetChildrenByAttrib(document.body,"TAG");
  elt_count=elt_count+tagged_elts.length;
  var i=0; while (i<tagged_elts.length) {
    var elt=tagged_elts[i++];
    var tagspec=elt.getAttribute('TAG');
    var dterm;
    if (knowlet) 
      dterm=knowlet.handleEntry(tagspec);
    else {
      var start;
      var end=tagspec.indexOf(';');
      if (tagspec.search(/\w/)===0) start=0;
      else start=1;
      dterm=tagspec.slice(start,end);}
    tag_count++;
    elt.dterm=dterm; elt.setAttribute("dterm",dterm);
    var container=elt.parentNode;
    while (container) {
      if (container.id) break;
      else container=container.parentNode;}
    if (container) sbookAddTag(container,dterm);}
  var done=new Date();
  sbook_tagged_count=elt_count;
  fdjtLog("Got %d tags from %d elements in %f secs, %s now has %d dterms",
	  tag_count,elt_count,(done.getTime()-start.getTime())/1000,
	  knowlet.name,knowlet.alldterms.length);
}

/* Search functions */

// Configuration

// Whether query results are 'scored' by the number and prominence of
// individual tags.  Otherwise, the query results are just a conjunction
// of the non-empty tags
var sbook_fuzzy_queries=false;

function sbook_lookup_term(term,table)
{
  if (term==="") return [];
  // This covers the term cache
  else if (table) return table[term];
  else if (term[0]==='\'') {
    // This covers literal searches, which can take a while
    var items=sbook_word_index[term];
    if (items) return items;
    var slashpos=term.indexOf('/');
    if (slashpos)
	 items=sbook_word_index[term.slice(0,slashpos)];
    if (items) return items;
    if (slashpos) {
      var regex_end=term.indexOf('/',slashpos+1);
      var regex=new RegExp(term.slice(slashpos+1,regex_end),
			   term.slice(regex_end+1));
      var baseterm=term.slice(0,slashpos);
      var items=fdjtSearchContent(document.body,term);
      sbook_word_index[baseterm]=items;
      return items;}
    else {
      var items=fdjtSearchContent(document.body,term);
      sbook_word_index[term]=items;
      return items;}}
  // This returns the info from the index
  else return sbook_index[term]||[];
}

function sbookDoSearch(query,results)
{
  var base=false;
  var sources=[];
  var simple=(!(results._fuzzy));
  // A query is an array of terms.  In a simple query,
  // the results are simply all elements which are tagged
  // with all of the query terms.  In a linear scored query,
  // a score is based on how many of the query terms are matched,
  // possibly with weights based on the basis of the match.
  var i=0; while (i<query.length) {
    var term=query[i++];
    var items=sbook_lookup_term(term);
    if (sbook_trace_search)
      fdjtLog("Query element '%s' matches %d items",
	      term,items.length);
    if (items.length>0) {
      // We just ignore terms that don't have any results
      if (simple)
	// Simple queries just do an intersection, requiring
	// matches in every query element
	if (base) base=fdjtIntersect(base,items);
	else base=items;
      else if (!(base)) {
	// Fuzzy queries only require a match in the first query
	// element.
	base=items;}}}
  // Apply any social filters
  // Trying different approach
  // base=sbook_limit_search(base,(query._sources)||(sbook_sources));
  // Initialize scores for all of results
  var j=0; while (j<base.length) {
    var elt=base[j++];
    if (elt.pingid) {
      var user=elt.user; var tribes=elt.tribes;
      if (sources.indexOf(user)<0) sources.push(user);
      if (tribes) {
	var k=0; while (k<tribes.length) {
	  var tribe=tribes[k++];
	  if (sources.indexOf(tribe)<0) sources.push(tribe);}}}
    results[elt.sortkey]=1;}
  results._sources=sources;
  var i=0; while (i<query.length) {
    var qelt=query[i++];
    var prime=sbook_lookup_term(qelt,sbook_prime_index)||[];
    var direct=sbook_lookup_term(qelt,sbook_direct_index)||[];
    var k=0; while (k<prime.length) {
      var score;
      var elt=prime[k++]; var sortkey=elt.sortkey;
      if (score=results[sortkey])
	results[sortkey]=score+1;}
    var k=0; while (k<direct.length) {
      var score;
      var elt=direct[k++]; var sortkey=elt.sortkey;
      if (score=results[sortkey]) results[sortkey]=score+1;}}
  results._results=base;
  return results;
}

function sbookGetRefiners(results)
{
  // This gets terms which can refine this search, particularly
  // terms which occur in most of the results.
  if (results._refiners) return results._refiners;
  var query=results._query;
  var rvec=(results._results);
  var refiners={}; var freqs={}; var alltags=[];
  var i=0; while (i<rvec.length) {
    var item=rvec[i++];
    var item_score=results[item.sortkey];
    if (typeof item === "string") item=document.getElementById(item);
    if ((item) && (item.tags)) {
      var tags=item.tags; var j=0; while (j<tags.length) {
	var tag=tags[j++];
	// If the tag is already part of the query, we ignore it.
	if (query.indexOf(tag)>=0) {}
	// If the tag is already a refiner, we increase its score.
	else if (!(refiners[tag])) {
	  // If the tag isn't a refiner, we initialize its score
	  // and add it to the list of all the tags we've found
	  alltags.push(tag);
	  freqs[tag]=1;
	  refiners[tag]=item_score;}
	else {
	  freqs[tag]=freqs[tag]+1;
	  refiners[tag]=refiners[tag]+item_score;}}}}
  freqs._count=rvec.length;
  refiners._freqs=freqs;
  results._refiners=refiners;
  alltags.sort(function(x,y) {
      if (freqs[x]>freqs[y]) return -1;
      else if (freqs[x]===freqs[y]) return 0;
      else return 1;});
  refiners._results=alltags;
  if (sbook_trace_search>1) /*  */
    fdjtLog("Refiners for %o are (%o) %o",
	    results._query,refiners,alltags);
  return refiners;
}

/* Utility functions */

// A query is an array of dterms (or literal searches)
// The string form of a query consists of dterms followed
// by semicolons

function sbookStringToQuery(string)
{
  if (typeof string === "string") {
    var lastsemi=string.lastIndexOf(';');
    if (lastsemi>0)
      return string.slice(0,lastsemi).split(';');
    else return [];}
  else return string;
}

function sbookQueryToString(query)
{
  if ((typeof query === "object") && (query instanceof Array))
    return query.join(';')+';';
  else return query;
}

function sbookQueryBase(string)
{
  var lastsemi=string.lastIndexOf(';');
  if (lastsemi>0)
    return string.slice(0,lastsemi+1);
  else return ";";
}

/* Top level query construction */

var sbook_simple_queries={};
var sbook_scored_queries={};

function sbookQuery(query,init)
{
  if (typeof query === "string")
    query=sbookStringToQuery(query);
  // Look up in the cache.
  var simple=((init) ? ((init.simple)||true) : (true));
  var qstring=sbookQueryToString(query);
  var result=
    ((simple) ? (sbook_simple_queries) : (sbook_simple_queries))[qstring];
  if (result) return result;
  // Construct the results object
  if (init) result=init; result={};
  result._simple=simple; result._results=[];
  result._query=query; result._qstring=qstring; 
  if (query.length===0) {
    result._refiners={};
    result._refiners._results=sbook_all_tags;
    return result;}
  var start=new Date();
  // Do the search
  sbookDoSearch(query,result);
  var search_done=new Date();
  if (result._refiners) {}
  else if (result._results.length>1)
    sbookGetRefiners(result,query);
  else {
    result._refiners={};
    result._refiners._results=[];}
  var refiners_done=new Date();
  if (sbook_trace_search)
    fdjtLog("In %f secs, %o yielded %d results: %o",
	    ((search_done.getTime()-start.getTime())/1000),
	    query,result._results.length,result._results);
  if (sbook_trace_search)
    fdjtLog("In %f secs, query %o yielded %d refiners: %o",
	    ((refiners_done.getTime()-search_done.getTime())/1000),
	    query,result._refiners._results.length,
	    result._refiners._results);
  if (simple) sbook_simple_queries[qstring]=result;
  else sbook_simple_queries[qstring]=result;
  return result;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
