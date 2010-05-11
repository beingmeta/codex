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

/*
  New design:
   sbookIndex inherits from knowletIndex
     has methods for processing docinfo, technorati tags, etc
     KnowletIndex has constructor method Query for creating a query object
     and doing a search
     KnowletCloud contains the cloud code from searchui, taking
       a query
*/
     
function sbookIndexTags(docinfo)
{
  /* One pass processes all of the inline DTerms and
     also separates out primary and auto tags. */
  for (var eltid in docinfo) {
    var tags=docinfo[eltid].tags;
    if (!(tags)) continue;
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
  var knowlet=document.knowlet||false;
  if (!(sbook_index)) sbook_index=new KnowletIndex(knowlet);
  sbook_index.Tags=function(item){return docinfo[item].tags;};
  for (var eltid in docinfo) {
    var tags=docinfo[eltid].tags;
    if (!(tags)) continue;
    var k=0; var ntags=tags.length;
    while (k<ntags) {
      var tag=tags[k++];
      sbook_index.add(eltid,tag,tags[tag]||1,knowlet);}}
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
      var dterm=((kno)?(kno.handleEntry(tag)):(fdjtString.stdspace(tag)));
      sbook_index.add(cxt,dterm);}
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
    fdjtLog("[%f] Making full cloud over %d tags",
	    fdjtElapsedTime(),book_tags.length);
  // The scores here are used to determine sizes in the cloud
  // A regular index reference counts as 1 and a prime reference counts
  //  as one more.
  var bykey=sbook_index.bykey; var alltags=[];
  for (var tag in bykey) {
    tagfreqs[tag]=bykey[tag].length;
    alltags.push(tag);}
  tagfreqs._count=alltags.length;
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
