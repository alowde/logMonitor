#!/usr/bin/perl -w

use strict;
use v5.10;

use DBI;
use File::Pid;

use sigtrap qw(handler clean_stop normal-signals);

my $dbg = 1;

#  PID file handler
my $pidfile = File::Pid->new({
    file => '/var/run/cron.pid',
});
if ( my $num = $pidfile->running ) {
    clean_stop("cron.pl appears to already be running, PID $num was recorded in /var/run/cron.pid\n");
}
$pidfile->write;


#   Prepare the database connection and select statements
        my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or clean_stop("Failed to connect to database\n");
        #  sqlMinProcessed finds the number of the least processed record in the table
        my $sqlMinProcessed = "SELECT MIN(`processed`) FROM `syslog_messages`;";
        #  For maximum speed, where possible we avoid running a regex against multiple fields.
        #  This is believed to save time by avoiding MySQL searching for the regex ".*", which
        #  should match all fields anyway.

        #  When we do have to run against multiple fields we currently just run regex against 
        #  all of them. 

        #  Processing `message` first in this case is useful as it's likely to
        #  fail early, short-cutting the query.
        my $sqlUpdateAll = "UPDATE LOW_PRIORITY `syslog_messages` SET `priority` = `priority` + ? WHERE `processed` = ? AND `message` REGEXP ? AND `host` REGEXP ? AND `program` REGEXP ? AND `pid` REGEXP ? AND `datetime` REGEXP ?;";
        my $sqlUpdateDatetime = "UPDATE LOW_PRIORITY `syslog_messages` SET `priority` = `priority` + ? WHERE `processed` = ? AND `datetime` REGEXP ?;";
        my $sqlUpdateHost = "UPDATE LOW_PRIORITY `syslog_messages` SET `priority` = `priority` + ?, `processed` = ? WHERE `processed` = ? AND `host` REGEXP ?;";
        my $sqlUpdateProgram = "UPDATE LOW_PRIORITY `syslog_messages` SET `priority` = `priority` + ?, `processed` = ? WHERE `processed` = ? AND `program` REGEXP ?;";
        my $sqlUpdatePid = "UPDATE LOW_PRIORITY `syslog_messages` SET `priority` = `priority` + ?, `processed` = ? WHERE `processed` = ? AND `pid` REGEXP ?;";
        my $sqlUpdateMessage = "UPDATE LOW_PRIORITY `syslog_messages` SET `priority` = `priority` + ? WHERE `processed` = ? AND `message` REGEXP ?;";
        
        my $stmtMinProcessed = $dbConnection->prepare($sqlMinProcessed);
        my $stmtUpdateAll = $dbConnection->prepare($sqlUpdateAll);
        my $stmtUpdateDatetimeOnly = $dbConnection->prepare($sqlUpdateDatetime);
        my $stmtUpdateHostOnly = $dbConnection->prepare($sqlUpdateHost);
        my $stmtUpdateProgramOnly = $dbConnection->prepare($sqlUpdateProgram);
        my $stmtUpdatePidOnly = $dbConnection->prepare($sqlUpdatePid);
        my $stmtUpdateMessageOnly = $dbConnection->prepare($sqlUpdateMessage);
        my $stmtSetProcessed = $dbConnection->prepare("UPDATE LOW_PRIORITY `syslog_messages` SET `processed` = ?  WHERE `processed` = ?;");

    do {
        my @regexes = initialiseRegexes();
        $stmtMinProcessed->execute or clean_stop("Unable to find out least-processed row");
        my $minProc = ($stmtMinProcessed->fetchrow_array)[0];
        $stmtMinProcessed->finish;                          #  Calling finish straight away as there's only one row to fetch, and we have it

        for (my $i = $minProc + 1; $i <= $#regexes; $i++) { #  If any rows have a lower processed number than the number of regexes:

            my $msg = $regexes[$i]->{message};

            if ($dbg) {
                say "DEBUG: minProcessed = $minProc";
                say "DEBUG: regexes length = $#regexes";
                say "DEBUG: current iteration $i";
                print "DEBUG: regex at iteration is ";
                while ( (my $key, my $value) = each $regexes[$i]) {
                    unless ($value) { $value = ''; }
                    print "$key => $value, ";
                }
                $msg =~ s/\(/\\\(/g; 
                say "\nDEBUG: message regex at iteration is $msg";
            }
            if (($regexes[$i]->{message} ne ".*")
                and ($regexes[$i]->{host} and ($regexes[$i]->{host} eq ".*"))
                and ($regexes[$i]->{program} and ($regexes[$i]->{program} eq ".*"))
                and ($regexes[$i]->{pid} and ($regexes[$i]->{pid} eq ".*"))
                and ($regexes[$i]->{datestamp} and ($regexes[$i]->{datestamp} eq ".*"))) {    #  We can use the faster UpdateMessage statement and save the DB server some tim searching

                $stmtUpdateMessageOnly->bind_param(1, $regexes[$i]->{priority});
                $stmtUpdateMessageOnly->bind_param(2, $minProc);
                $stmtUpdateMessageOnly->bind_param(3, $msg);
                $stmtUpdateMessageOnly->execute or clean_stop("Whelp, failed to run the message regex");
            }else{ #  All more specific regexes (that have been implemented) failed, so we'll use the UpdateAll statement
                $stmtUpdateAll->bind_param(1, $regexes[$i]->{priority});
                $stmtUpdateAll->bind_param(2, $minProc);
                $stmtUpdateAll->bind_param(3, $regexes[$i]->{message});
                $stmtUpdateAll->bind_param(4, $regexes[$i]->{host});
                $stmtUpdateAll->bind_param(5, $regexes[$i]->{program});
                $stmtUpdateAll->bind_param(6, $regexes[$i]->{pid});
                $stmtUpdateAll->bind_param(7, $regexes[$i]->{datetime});
                $stmtUpdateAll->execute or clean_stop("Failed to run the UpdateAll statement");
            }
        }
        $stmtSetProcessed->execute(($#regexes, $minProc));  #  Auto-bind length of regex array to processed field, and set that on all rows
        sleep 120; #  At this point we've iterated through all previously unprocessed regexes, so we sleep before starting again

    } while 1;




sub initialiseRegexes {

    my @returnArray;
    my $dbConnection = DBI->connect('dbi:mysql:syslogng','syslog','secoifjwe')
                            or clean_stop("Failed to connect to database when initialising regexes\n");
#   Grab all regexes from table
    my $sql = "SELECT * FROM `regexes`";
    my $statement = $dbConnection->prepare($sql);
    $statement->execute or clean_stop("Failed to load regexes from table");
#   Push each regex onto the return array as a set of key-value pairs
    while (my @row = $statement->fetchrow_array) {
        push @returnArray, {
                id          => $row[0],
                datestamp   => $row[1],
                host        => $row[2],
                program     => $row[3],
                pid         => $row[4],
                message     => $row[5],
                processed   => $row[6],
                priority    => $row[7],
        };
    };

    return @returnArray;
}

sub clean_stop {

    $dbConnection->disconnect();
    $pidfile->remove or say "Warning! Couldn't remove PID file, will need to be deleted manually";
    say $_ ? $_ : "Received kill signal, exiting gracefully.\n";
    exit 0;

}

