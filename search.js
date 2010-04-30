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

function sbookAddTag(elt,tag,weight,kno)
{
  if ((typeof elt === 'string')||(typeof elt === 'number'))
    sbook_index.add(elt,tag,weight,kno);
  else sbook_index.add(elt.id||elt._fdjtid||fdjtKB.register(elt),
		       tag,weight,kno);
}

function sbookNewTag(tag,kno)
{
  if (!(kno)) kno=knowlet;
  if ((typeof tag === "string") && (tag[0]==="\u00A7")) {}
  else if ((kno) && (typeof tag === "string"))
    tag=(KnowDef(tag,kno))||(tag);
  // Force a sortkey
  var dterm=((typeof tag === "string") ? (tag) : (tag.dterm));
  return dterm;
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
      if (knowde) {
      // fdjtTrace("adding tag %o to %s",knowde,elt.id);
	sbookAddTag(elt,knowde,prime);}}}
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

/* Search functions */

// Configuration

function sbook_lookup_term(term,table)
{
  if (term==="") return [];
  if (!(table)) table=sbook_index;
  if (table.hasOwnProperty(term))
    return table[term];
  else return fdjtKB.Set();
}

function sbookDoSearch(query,results)
{
  var base=false;
  // A query is an array of terms.  In a simple query,
  // the results are simply all elements which are tagged
  // with all of the query terms.  In a linear scored query,
  // a score is based on how many of the query terms are matched,
  // possibly with weights based on the basis of the match.
  var i=0; while (i<query.length) {
    var term=query[i++];
    var items=sbook_index.find(term);
    if (sbook_trace_search)
      fdjtLog("Query element '%s' matches %d items",
	      term,items.length);
    if (items.length===0) continue;
    else if (base) 
      base=base.intersection(items);
    else base=items;}
  var allitems=base.get();
  i=0; var n_items=allitems.length;
  while (i<n_items)
    sbook_index.score(allitems[i++],results);
  // Initialize scores for all of results
  results._results=allitems;
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
    var item_score=results[item];
    var tags=sbook_taginfo[item];
    if (tags) {
      var j=0; var len=tags.length; while (j<len) {
	var tag=tags[j++];
	// If the tag is already part of the query, we ignore it.
	if (fdjtKB.contains(query,tag)) {}
	// If the tag has already been seen, we increase its frequency
	// and its general score
	else if (freqs[tag]) {
	  freqs[tag]=freqs[tag]+1;
	  refiners[tag]=refiners[tag]+item_score;}
	else {
	  // If the tag hasn't been counted, we initialize its frequency
	  // and score, adding it to the list of all the tags we've found
	  alltags.push(tag); freqs[tag]=1;
	  refiners[tag]=item_score;}}}}
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

function sbookIndexTags(taginfo)
{
  /* One pass processes all of the inline DTerms and
     also separates out primary and auto tags. */
  for (var eltid in taginfo) {
    var tags=taginfo[eltid];
    var k=0; var ntags=tags.length;
    while (k<ntags) {
      var tag=tags[k];
      if (tag[0]==='*') {
	var tagstart=tag.search(/[^*]+/);
	tags[k]=tag=tag.slice(tagstart);
	tags[tag]=2*tagstart;}
      else if (tag[0]==='~') tags[k]=tag=tag.slice(1);
      else tags[tag]=2;
      if ((tag.indexOf('|')>=0)) knowlet.handleSubjectEntry(tag);
      k++;}}
  if (!(sbook_index)) sbook_index=new KnowletIndex();
  var knowlet=document.knowlet||false;
  for (var eltid in taginfo) {
    var tags=taginfo[eltid];
    var k=0; var ntags=tags.length;
    while (k<ntags) {
      var tag=tags[k++];
      sbook_index.add(eltid,tag,tags[tag]||1,knowlet);}}    
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

/* Inline knowlets */

function sbookHandleInlineKnowlets(scanstate)
{
  var kno=((scanstate.knowlet)||knowlet);
  var taggings=scanstate.taggings;
  var i=0; var n=taggings.length; while (i<n) {
    var tags=taggings[i++].tags;
    var j=0; var ntags=tags.length;
    while (j<ntags)
      if (tags[j].indexOf('|')) kno.handleSubjectEntry(tags[j++]);
      else j++;}
}

function sbookIndexTechnoratiTags(kno)
{
  if (!(kno)) kno=knowlet;
  var anchors=document.getElementsByTagName("A");
  if (!(anchors)) return;
  var i=0; var len=anchors.length;
  while (i<len)
    if (anchors[i].rel==='tag') {
      var elt=anchors[i++];
      var href=elt.href;
      var cxt=elt;
      while (cxt) if (cxt.id) break; else cxt=cxt.parentNode;
      if (!((href)&&(cxt))) return;
      var tagstart=(href.search(/[^/]+$/));
      var tag=((tagstart<0)?(href):href.slice(tagstart));
      var dterm=((kno)?(kno.handleEntry(tag)):(fdjtStdSpace(tag)));
      sbookAddTag(cxt,dterm);}
    else i++;
}

/* Processing tags when all done */

var sbook_tagscores=false;

function sbookTagScores()
{
  if (sbook_tagscores) return sbook_tagscores;
  var tagscores={}; var tagfreqs={}; var alltags=[];
  var book_tags=sbook_index._all;
  if (sbook_trace_clouds)
    fdjtLog("[%f] Making full cloud over %d tags",fdjtElapsedTime(),book_tags.length);
  // The scores here are used to determine sizes in the cloud
  // A regular index reference counts as 1 and a prime reference counts
  //  as one more.
  var bykey=sbook_index.bykey; var alltags=[];
  for (var tag in bykey) {
    tagfreqs[tag]=bykey[tag].elements.length;
    alltags.push(tag);}
  alltags.sort(function (x,y) {
      var xlen=tagfreqs[x]; var ylen=tagfreqs[y];
      if (xlen==ylen) return 0;
      else if (xlen>ylen) return -1;
      else return 1;});
  tagscores._all=alltags; tagscores._freq=tagfreqs;
  sbook_tagscores=tagscores;
  return tagscores;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
